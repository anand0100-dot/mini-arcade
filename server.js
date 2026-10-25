
"use strict";

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 8082;

// Separate room stores for each game.
const rooms = new Map();
const rpsRooms = new Map();

app.use(express.static(__dirname));

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        application: "MiniArcade"
    });
});

function cleanName(value) {
    if (typeof value !== "string") return "";
    return value.trim().replace(/[<>]/g, "").slice(0, 16);
}

function createRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code;

    do {
        code = Array.from({ length: 5 }, () =>
            chars[Math.floor(Math.random() * chars.length)]
        ).join("");
    } while (rooms.has(code) || rpsRooms.has(code));

    return code;
}

function findPlayerRoom(socketId, roomStore) {
    for (const room of roomStore.values()) {
        if (room.players.some(player => player.id === socketId)) {
            return room;
        }
    }

    return null;
}

// =====================================================
// TIC-TAC-TOE
// =====================================================

function getTicTacToeWinner(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    for (const [a, b, c] of lines) {
        if (
            board[a] &&
            board[a] === board[b] &&
            board[a] === board[c]
        ) {
            return board[a];
        }
    }

    return board.every(Boolean) ? "draw" : null;
}

function sendTicTacToeState(room) {
    for (const player of room.players) {
        io.to(player.id).emit("room-state", {
            code: room.code,
            board: room.board,
            currentPlayer: room.currentPlayer,
            players: room.players.map(p => ({
                name: p.name,
                symbol: p.symbol,
                connected: io.sockets.sockets.has(p.id)
            })),
            mySymbol: player.symbol,
            status: room.status,
            winner: room.winner
        });
    }
}

// =====================================================
// ROCK PAPER SCISSORS
// =====================================================

function sendRpsState(room) {
    for (const player of room.players) {
        io.to(player.id).emit("rps-room-state", {
            code: room.code,
            myId: player.id,
            players: room.players.map(p => ({
                id: p.id,
                name: p.name,
                connected: io.sockets.sockets.has(p.id)
            })),
            scores: { ...room.scores },
            round: room.round,
            status: room.status,
            choices: room.players.map(p => ({
                id: p.id,
                name: p.name,
                submitted: Boolean(p.choice),
                choice: room.status === "result" ? p.choice : null
            })),
            result: room.result
        });
    }
}

function resolveRpsRound(room) {
    const [first, second] = room.players;

    const beats = {
        Rock: "Scissors",
        Paper: "Rock",
        Scissors: "Paper"
    };

    let winner = "draw";

    if (first.choice !== second.choice) {
        winner = beats[first.choice] === second.choice
            ? first.id
            : second.id;

        room.scores[winner]++;
    }

    room.result = {
        winner,
        text: winner === "draw"
            ? "It's a draw!"
            : `${room.players.find(p => p.id === winner).name} wins this round!`
    };

    room.status = "result";
}

// =====================================================
// SOCKET EVENTS
// =====================================================

io.on("connection", socket => {
    console.log(`Player connected: ${socket.id}`);

    // ---------------- TIC-TAC-TOE: CREATE ROOM ----------------

    socket.on("create-room", (rawName, callback) => {
        const name = cleanName(rawName);

        if (!name) {
            return callback?.({ error: "Enter your name first." });
        }

        if (findPlayerRoom(socket.id, rooms) ||
            findPlayerRoom(socket.id, rpsRooms)) {
            return callback?.({
                error: "Leave your current game before creating another."
            });
        }

        const code = createRoomCode();

        const room = {
            code,
            players: [{ id: socket.id, name, symbol: "X" }],
            board: Array(9).fill(""),
            currentPlayer: "X",
            status: "waiting",
            winner: null
        };

        rooms.set(code, room);
        socket.join(`ttt:${code}`);

        callback?.({ code });
        sendTicTacToeState(room);

        console.log(`Tic-Tac-Toe room created: ${code}`);
    });

    // ---------------- TIC-TAC-TOE: JOIN ROOM ----------------

    socket.on("join-room", ({ code: rawCode, name: rawName } = {}, callback) => {
        const name = cleanName(rawName);
        const code = typeof rawCode === "string"
            ? rawCode.trim().toUpperCase()
            : "";

        const room = rooms.get(code);

        if (!name) {
            return callback?.({ error: "Enter your name first." });
        }

        if (findPlayerRoom(socket.id, rooms) ||
            findPlayerRoom(socket.id, rpsRooms)) {
            return callback?.({
                error: "Leave your current game before joining another."
            });
        }

        if (!room) {
            return callback?.({ error: "Room not found. Check the code." });
        }

        if (room.players.length >= 2 || room.status !== "waiting") {
            return callback?.({ error: "This room is full or unavailable." });
        }

        room.players.push({ id: socket.id, name, symbol: "O" });
        room.status = "playing";

        socket.join(`ttt:${code}`);

        callback?.({ code });
        sendTicTacToeState(room);

        console.log(`${name} joined Tic-Tac-Toe room ${code}`);
    });

    // ---------------- TIC-TAC-TOE: MAKE MOVE ----------------

    socket.on("make-move", index => {
        const room = findPlayerRoom(socket.id, rooms);

        if (!room || room.status !== "playing") return;
        if (!Number.isInteger(index) || index < 0 || index > 8) return;

        const player = room.players.find(p => p.id === socket.id);

        if (!player || player.symbol !== room.currentPlayer) return;
        if (room.board[index] !== "") return;

        room.board[index] = player.symbol;

        const result = getTicTacToeWinner(room.board);

        if (result) {
            room.status = "finished";
            room.winner = result;
        } else {
            room.currentPlayer = player.symbol === "X" ? "O" : "X";
        }

        sendTicTacToeState(room);
    });

    // ---------------- TIC-TAC-TOE: RESET ----------------

    socket.on("reset-game", () => {
        const room = findPlayerRoom(socket.id, rooms);

        if (!room || room.status !== "finished") return;

        room.board = Array(9).fill("");
        room.currentPlayer = "X";
        room.winner = null;
        room.status = "playing";

        sendTicTacToeState(room);
    });

    // ---------------- RPS: CREATE ROOM ----------------

    socket.on("rps-create-room", (rawName, callback) => {
        const name = cleanName(rawName);

        if (!name) {
            return callback?.({ error: "Enter your name first." });
        }

        if (findPlayerRoom(socket.id, rooms) ||
            findPlayerRoom(socket.id, rpsRooms)) {
            return callback?.({
                error: "Leave your current game before creating another."
            });
        }

        const code = createRoomCode();

        const room = {
            code,
            players: [{ id: socket.id, name, choice: null }],
            scores: {},
            round: 1,
            status: "waiting",
            result: null
        };

        room.scores[socket.id] = 0;

        rpsRooms.set(code, room);
        socket.join(`rps:${code}`);

        callback?.({ code });
        sendRpsState(room);

        console.log(`Rock Paper Scissors room created: ${code}`);
    });

    // ---------------- RPS: JOIN ROOM ----------------

    socket.on("rps-join-room", ({ code: rawCode, name: rawName } = {}, callback) => {
        const name = cleanName(rawName);
        const code = typeof rawCode === "string"
            ? rawCode.trim().toUpperCase()
            : "";

        const room = rpsRooms.get(code);

        if (!name) {
            return callback?.({ error: "Enter your name first." });
        }

        if (findPlayerRoom(socket.id, rooms) ||
            findPlayerRoom(socket.id, rpsRooms)) {
            return callback?.({
                error: "Leave your current game before joining another."
            });
        }

        if (!room) {
            return callback?.({ error: "Room not found. Check the code." });
        }

        if (room.players.length >= 2 || room.status !== "waiting") {
            return callback?.({ error: "This room is full or unavailable." });
        }

        room.players.push({ id: socket.id, name, choice: null });
        room.scores[socket.id] = 0;
        room.status = "playing";

        socket.join(`rps:${code}`);

        callback?.({ code });
        sendRpsState(room);

        console.log(`${name} joined RPS room ${code}`);
    });

    // ---------------- RPS: SUBMIT CHOICE ----------------

    socket.on("rps-make-choice", choice => {
        const room = findPlayerRoom(socket.id, rpsRooms);
        const allowed = ["Rock", "Paper", "Scissors"];

        if (!room || room.status !== "playing") return;
        if (!allowed.includes(choice)) return;

        const player = room.players.find(p => p.id === socket.id);

        if (!player || player.choice !== null) return;

        player.choice = choice;

        if (
            room.players.length === 2 &&
            room.players.every(p => p.choice !== null)
        ) {
            resolveRpsRound(room);
        }

        sendRpsState(room);
    });

    // ---------------- RPS: NEXT ROUND ----------------

    socket.on("rps-next-round", () => {
        const room = findPlayerRoom(socket.id, rpsRooms);

        if (!room || room.status !== "result") return;

        room.players.forEach(player => {
            player.choice = null;
        });

        room.round++;
        room.result = null;
        room.status = "playing";

        sendRpsState(room);
    });

    // ---------------- DISCONNECT HANDLING ----------------

    socket.on("disconnect", () => {
        console.log(`Player disconnected: ${socket.id}`);

        for (const [code, room] of rooms) {
            const playerExists = room.players.some(p => p.id === socket.id);

            if (!playerExists) continue;

            rooms.delete(code);

            for (const player of room.players) {
                if (player.id !== socket.id) {
                    io.to(player.id).emit("opponent-left");
                }
            }
        }

        for (const [code, room] of rpsRooms) {
            const playerExists = room.players.some(p => p.id === socket.id);

            if (!playerExists) continue;

            rpsRooms.delete(code);

            for (const player of room.players) {
                if (player.id !== socket.id) {
                    io.to(player.id).emit("opponent-left");
                }
            }
        }
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`MiniArcade server running at http://localhost:${PORT}`);
});

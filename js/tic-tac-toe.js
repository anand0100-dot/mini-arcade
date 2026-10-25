
"use strict";

function startTicTacToe(container) {
    let socket = null;
    let mode = "menu";
    let board = Array(9).fill("");
    let currentPlayer = "X";
    let gameOver = false;
    let mySymbol = null;
    let roomCode = "";

    container.innerHTML = `
        <div class="game-center">
            <div id="ttt-menu">
                <p class="game-stat">CHOOSE YOUR GAME MODE</p>
                <button id="ttt-solo" class="game-action">🎮 Play Solo vs Computer</button>
                <button id="ttt-create" class="game-action">👥 Create Room</button>

                <p class="game-stat">OR JOIN YOUR FRIEND'S ROOM</p>
                <label for="ttt-name">Your name</label>
                <input id="ttt-name" class="guess-input" maxlength="16"
                       placeholder="Enter your name">
                <input id="ttt-code" class="guess-input" maxlength="5"
                       placeholder="5-character room code"
                       style="text-transform:uppercase">
                <button id="ttt-join" class="game-action">Join Room</button>
                <p id="ttt-message" class="game-message">
                    Play solo against the computer or create a room with a friend.
                </p>
            </div>

            <div id="ttt-play" hidden>
                <p id="ttt-mode" class="game-stat"></p>
                <p id="ttt-room" class="game-stat"></p>
                <p id="ttt-turn" class="game-message"></p>
                <div id="ttt-board" class="game-board ttt-board"></div>
                <button id="ttt-again" class="game-action" hidden>Play Again</button>
                <button id="ttt-back" class="game-action">Back to Menu</button>
            </div>
        </div>
    `;

    const $ = selector => container.querySelector(selector);
    const menu = $("#ttt-menu");
    const playArea = $("#ttt-play");
    const boardElement = $("#ttt-board");
    const message = $("#ttt-message");

    const winLines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    function getWinner(cells) {
        for (const [a, b, c] of winLines) {
            if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
                return cells[a];
            }
        }
        return cells.every(Boolean) ? "draw" : null;
    }

    function showPlayArea() {
        menu.hidden = true;
        playArea.hidden = false;
    }

    function closeSocket() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
    }

    function backToMenu() {
        closeSocket();
        mode = "menu";
        board = Array(9).fill("");
        roomCode = "";
        mySymbol = null;
        menu.hidden = false;
        playArea.hidden = true;
        message.textContent = "Choose Solo, create a room, or join a room.";
    }

    function renderBoard() {
        boardElement.replaceChildren();

        board.forEach((value, index) => {
            const cell = document.createElement("button");
            cell.className = "ttt-cell";
            cell.textContent = value;
            cell.setAttribute("aria-label", `Cell ${index + 1}: ${value || "empty"}`);

            if (mode === "solo") {
                cell.disabled = Boolean(value) || gameOver ||
                    currentPlayer !== "X";
            } else {
                cell.disabled = Boolean(value) || gameOver ||
                    currentPlayer !== mySymbol;
            }

            cell.addEventListener("click", () => {
                if (mode === "solo") {
                    makeSoloMove(index);
                } else if (mode === "multiplayer" && socket) {
                    socket.emit("make-move", index);
                }
            });

            boardElement.appendChild(cell);
        });
    }

    function updateLocalResult(result) {
        gameOver = true;
        $("#ttt-turn").textContent =
            result === "draw" ? "🤝 It's a draw!" :
            result === "X" ? "🎉 You win!" : "🤖 Computer wins!";
        $("#ttt-again").hidden = false;
        renderBoard();
    }

    function makeSoloMove(index) {
        if (mode !== "solo" || gameOver || board[index] ||
            currentPlayer !== "X") return;

        board[index] = "X";
        let result = getWinner(board);

        if (result) {
            updateLocalResult(result);
            return;
        }

        currentPlayer = "O";
        $("#ttt-turn").textContent = "Computer is thinking…";
        renderBoard();

        window.setTimeout(() => {
            if (mode !== "solo" || gameOver) return;

            const move = findBestMove(board);
            if (move !== -1) board[move] = "O";

            result = getWinner(board);
            if (result) {
                updateLocalResult(result);
                return;
            }

            currentPlayer = "X";
            $("#ttt-turn").textContent = "Your turn — you are X.";
            renderBoard();
        }, 300);
    }

    // Minimax: the computer plays optimally.
    function findBestMove(cells) {
        let bestScore = -Infinity;
        let bestMove = -1;

        for (let i = 0; i < cells.length; i++) {
            if (cells[i]) continue;

            cells[i] = "O";
            const score = minimax(cells, 0, false);
            cells[i] = "";

            if (score > bestScore) {
                bestScore = score;
                bestMove = i;
            }
        }
        return bestMove;
    }

    function minimax(cells, depth, maximizing) {
        const result = getWinner(cells);
        if (result === "O") return 10 - depth;
        if (result === "X") return depth - 10;
        if (result === "draw") return 0;

        let best = maximizing ? -Infinity : Infinity;

        for (let i = 0; i < cells.length; i++) {
            if (cells[i]) continue;

            cells[i] = maximizing ? "O" : "X";
            const score = minimax(cells, depth + 1, !maximizing);
            cells[i] = "";

            best = maximizing
                ? Math.max(best, score)
                : Math.min(best, score);
        }

        return best;
    }

    function startSolo() {
        closeSocket();
        mode = "solo";
        board = Array(9).fill("");
        currentPlayer = "X";
        gameOver = false;
        roomCode = "";

        $("#ttt-mode").textContent = "SOLO MODE · YOU ARE X · COMPUTER IS O";
        $("#ttt-room").textContent = "";
        $("#ttt-turn").textContent = "Your turn — you are X.";
        $("#ttt-again").hidden = true;

        showPlayArea();
        renderBoard();
    }

    function connectMultiplayer() {
        closeSocket();
        mode = "multiplayer";
        socket = io();

        socket.on("connect_error", () => {
            message.textContent = "Cannot connect to the game server. Please try again.";
        });

        socket.on("room-state", state => {
            if (mode !== "multiplayer") return;

            board = [...state.board];
            mySymbol = state.mySymbol;
            roomCode = state.code;
            currentPlayer = state.currentPlayer;
            gameOver = state.status === "finished";

            $("#ttt-mode").textContent = "MULTIPLAYER ROOM";
            $("#ttt-room").textContent = `ROOM CODE: ${roomCode} · Share with your friend`;

            if (state.status === "waiting") {
                $("#ttt-turn").textContent = "Waiting for your friend to join…";
            } else if (state.status === "finished") {
                $("#ttt-turn").textContent = state.winner === "draw"
                    ? "🤝 It's a draw!"
                    : `${state.players.find(p => p.symbol === state.winner)?.name || state.winner} wins!`;
            } else {
                const current = state.players.find(p => p.symbol === currentPlayer);
                $("#ttt-turn").textContent = currentPlayer === mySymbol
                    ? `Your turn! You are ${mySymbol}.`
                    : `${current?.name || "Opponent"}'s turn.`;
            }

            $("#ttt-again").hidden = state.status !== "finished";
            showPlayArea();
            renderBoard();
        });

        socket.on("opponent-left", () => {
            $("#ttt-turn").textContent =
                "Your friend disconnected. Go back to the menu to start a new room.";
            $("#ttt-again").hidden = true;
        });
    }

    function createRoom() {
        const name = $("#ttt-name").value.trim();

        if (!name) {
            message.textContent = "Please enter your name first.";
            $("#ttt-name").focus();
            return;
        }

        connectMultiplayer();

        socket.emit("create-room", name, response => {
            if (response?.error) message.textContent = response.error;
        });
    }

    function joinRoom() {
        const name = $("#ttt-name").value.trim();
        const code = $("#ttt-code").value.trim().toUpperCase();

        if (!name) {
            message.textContent = "Please enter your name first.";
            $("#ttt-name").focus();
            return;
        }

        if (!/^[A-Z0-9]{5}$/.test(code)) {
            message.textContent = "Enter a valid 5-character room code.";
            $("#ttt-code").focus();
            return;
        }

        connectMultiplayer();

        socket.emit("join-room", { name, code }, response => {
            if (response?.error) message.textContent = response.error;
        });
    }

    $("#ttt-solo").addEventListener("click", startSolo);
    $("#ttt-create").addEventListener("click", createRoom);
    $("#ttt-join").addEventListener("click", joinRoom);
    $("#ttt-back").addEventListener("click", backToMenu);

    $("#ttt-code").addEventListener("input", event => {
        event.target.value = event.target.value.toUpperCase()
            .replace(/[^A-Z0-9]/g, "").slice(0, 5);
    });

    $("#ttt-again").addEventListener("click", () => {
        if (mode === "solo") {
            startSolo();
        } else if (mode === "multiplayer" && socket) {
            socket.emit("reset-game");
        }
    });
}

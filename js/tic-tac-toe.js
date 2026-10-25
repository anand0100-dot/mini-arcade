
"use strict";

function startTicTacToe(container) {
    const socket = io();
    let mySymbol = null;
    let roomCode = null;
    let gameState = null;
    let playerName = "";

    container.innerHTML = `
        <div class="game-center">
            <label for="mp-name">Your name</label>
            <input id="mp-name" class="guess-input"
                   maxlength="16" placeholder="Enter your name">

            <button id="mp-create" class="game-action">Create Room</button>

            <p class="game-stat">Or join your friend's room</p>
            <input id="mp-code" class="guess-input"
                   maxlength="5" placeholder="5-character room code"
                   style="text-transform:uppercase">

            <button id="mp-join" class="game-action">Join Room</button>
            <p id="mp-message" class="game-message">
                Create a room and invite a friend.
            </p>

            <div id="mp-board-area" hidden>
                <p id="mp-room" class="game-stat"></p>
                <p id="mp-turn" class="game-message"></p>
                <div id="mp-board" class="game-board ttt-board"></div>
                <button id="mp-reset" class="game-action" hidden>
                    Play Again
                </button>
            </div>
        </div>
    `;

    const $ = selector => container.querySelector(selector);
    const message = $("#mp-message");
    const boardArea = $("#mp-board-area");
    const boardElement = $("#mp-board");

    function send(action, data) {
        playerName = $("#mp-name").value.trim();

        if (!playerName) {
            message.textContent = "Please enter your name first.";
            return;
        }

        socket.emit(action, data, result => {
            if (result?.error) {
                message.textContent = result.error;
                return;
            }

            if (result?.code) {
                roomCode = result.code;
                message.textContent = `Room ${roomCode} created/joined!`;
            }
        });
    }

    $("#mp-create").addEventListener("click", () => {
        send("create-room", playerName);
    });

    $("#mp-join").addEventListener("click", () => {
        send("join-room", {
            name: $("#mp-name").value.trim(),
            code: $("#mp-code").value.trim()
        });
    });

    socket.on("room-state", state => {
        gameState = state;
        mySymbol = state.mySymbol;
        roomCode = state.code;

        boardArea.hidden = false;
        $("#mp-room").textContent = `Room code: ${state.code}`;
        message.textContent = state.players.length < 2
            ? "Waiting for your friend to join..."
            : `You are ${mySymbol}. Share code ${roomCode} with your friend.`;

        const turn = $("#mp-turn");

        if (state.status === "finished") {
            turn.textContent = state.winner === "draw"
                ? "It's a draw!"
                : `${state.players.find(p => p.symbol === state.winner)?.name || state.winner} wins!`;
        } else if (state.status === "waiting") {
            turn.textContent = "Waiting for opponent...";
        } else {
            const current = state.players.find(
                p => p.symbol === state.currentPlayer
            );

            turn.textContent = state.currentPlayer === mySymbol
                ? "Your turn!"
                : `${current?.name || "Opponent"}'s turn`;
        }

        boardElement.replaceChildren();

        state.board.forEach((value, index) => {
            const cell = document.createElement("button");
            cell.className = "ttt-cell";
            cell.textContent = value;
            cell.setAttribute("aria-label", `Cell ${index + 1}: ${value || "empty"}`);

            cell.disabled =
                state.status !== "playing" ||
                value !== "" ||
                state.currentPlayer !== mySymbol;

            cell.addEventListener("click", () => {
                socket.emit("make-move", index);
            });

            boardElement.appendChild(cell);
        });

        $("#mp-reset").hidden = state.status !== "finished";
    });

    $("#mp-reset").addEventListener("click", () => {
        socket.emit("reset-game");
    });

    socket.on("opponent-left", () => {
        message.textContent =
            "Your opponent disconnected. Create a new room to play again.";
        boardArea.hidden = true;
        roomCode = null;
        gameState = null;
    });

    socket.on("connect_error", () => {
        message.textContent = "Cannot connect to the game server. Try refreshing.";
    });
}

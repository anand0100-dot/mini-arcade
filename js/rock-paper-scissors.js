
"use strict";

function startRockPaperScissors(container) {
    const socket = io();

    let roomCode = null;
    let roomState = null;
    let submitted = false;

    const options = [
        { name: "Rock", emoji: "✊" },
        { name: "Paper", emoji: "✋" },
        { name: "Scissors", emoji: "✌️" }
    ];

    container.innerHTML = `
        <div class="game-center">
            <label for="rps-name">Your name</label>
            <input id="rps-name" class="guess-input"
                   maxlength="16" placeholder="Enter your name">

            <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap">
                <button id="rps-create" class="game-action">
                    + Create Room
                </button>
            </div>

            <p class="game-stat">OR JOIN YOUR FRIEND'S ROOM</p>

            <input id="rps-code" class="guess-input"
                   maxlength="5" placeholder="Enter 5-character room code"
                   style="text-transform:uppercase">

            <button id="rps-join" class="game-action">
                Join Room
            </button>

            <p id="rps-message" class="game-message">
                Create a room or join your friend's room to start playing.
            </p>

            <div id="rps-game" hidden>
                <p id="rps-room" class="game-stat"></p>
                <p id="rps-players" class="game-stat"></p>
                <p id="rps-round" class="game-stat"></p>
                <p id="rps-score" class="game-stat"></p>

                <p class="game-stat">CHOOSE YOUR MOVE</p>

                <div class="choice-row">
                    ${options.map(option => `
                        <button class="choice-btn"
                                data-choice="${option.name}"
                                aria-label="${option.name}"
                                title="${option.name}">
                            ${option.emoji}
                        </button>
                    `).join("")}
                </div>

                <p id="rps-status" class="game-message">
                    Waiting for players...
                </p>

                <div id="rps-result" class="game-stat"></div>

                <button id="rps-next" class="game-action" hidden>
                    Next Round →
                </button>
            </div>
        </div>
    `;

    const $ = selector => container.querySelector(selector);
    const message = $("#rps-message");
    const game = $("#rps-game");

    function setLobbyEnabled(enabled) {
        $("#rps-name").disabled = !enabled;
        $("#rps-code").disabled = !enabled;
        $("#rps-create").disabled = !enabled;
        $("#rps-join").disabled = !enabled;
    }

    function createRoom() {
        const name = $("#rps-name").value.trim();

        if (!name) {
            message.textContent = "Please enter your name first.";
            $("#rps-name").focus();
            return;
        }

        socket.emit("rps-create-room", name, response => {
            if (response?.error) {
                message.textContent = response.error;
                return;
            }

            roomCode = response.code;
            message.textContent =
                `Room ${roomCode} created! Share this code with your friend.`;

            setLobbyEnabled(false);
        });
    }

    function joinRoom() {
        const name = $("#rps-name").value.trim();
        const code = $("#rps-code").value.trim().toUpperCase();

        if (!name) {
            message.textContent = "Please enter your name first.";
            $("#rps-name").focus();
            return;
        }

        if (!/^[A-Z0-9]{5}$/.test(code)) {
            message.textContent = "Enter a valid 5-character room code.";
            $("#rps-code").focus();
            return;
        }

        socket.emit("rps-join-room", { name, code }, response => {
            if (response?.error) {
                message.textContent = response.error;
                return;
            }

            roomCode = response.code;
            message.textContent = `You joined room ${roomCode}!`;

            setLobbyEnabled(false);
        });
    }

    function updateChoiceButtons() {
        container.querySelectorAll("[data-choice]").forEach(button => {
            button.disabled =
                !roomState ||
                roomState.status !== "playing" ||
                submitted;
        });
    }

    function renderState(state) {
        roomState = state;
        roomCode = state.code;

        const myId = state.myId;

        const me = state.players.find(player => player.id === myId);
        const myChoice = state.choices.find(player => player.id === myId);

        submitted = Boolean(myChoice?.submitted);

        game.hidden = false;

        $("#rps-room").textContent = `ROOM CODE: ${state.code}`;

        $("#rps-players").textContent = state.players
            .map(player => player.name + (player.id === myId ? " (You)" : ""))
            .join(" vs ");

        $("#rps-round").textContent = `ROUND ${state.round}`;

        $("#rps-score").textContent = state.players
            .map(player =>
                `${player.name}: ${state.scores[player.id] ?? 0}`
            )
            .join(" | ");

        if (state.status === "waiting") {
            $("#rps-status").textContent =
                "Waiting for your friend to join...";
        } else if (state.status === "playing") {
            $("#rps-status").textContent = submitted
                ? "Your move is locked in! Waiting for your friend..."
                : "Choose Rock, Paper, or Scissors!";
        } else if (state.status === "result") {
            $("#rps-status").textContent = state.result?.text || "Round complete!";
        }

        $("#rps-result").textContent = state.status === "result"
            ? state.choices
                .map(player => {
                    const emoji = options.find(
                        option => option.name === player.choice
                    )?.emoji || "";

                    return `${player.name}: ${emoji} ${player.choice}`;
                })
                .join(" | ")
            : state.choices.some(player => player.submitted)
                ? "A player has selected a move."
                : "";

        $("#rps-next").hidden = state.status !== "result";

        updateChoiceButtons();

        if (me) {
            message.textContent =
                `Connected to room ${state.code}. Invite your friend if they haven't joined yet.`;
        }
    }

    $("#rps-create").addEventListener("click", createRoom);
    $("#rps-join").addEventListener("click", joinRoom);

    $("#rps-code").addEventListener("input", event => {
        event.target.value = event.target.value
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, 5);
    });

    container.querySelectorAll("[data-choice]").forEach(button => {
        button.addEventListener("click", () => {
            if (!roomState || roomState.status !== "playing" || submitted) {
                return;
            }

            submitted = true;
            updateChoiceButtons();

            socket.emit("rps-make-choice", button.dataset.choice);
        });
    });

    $("#rps-next").addEventListener("click", () => {
        socket.emit("rps-next-round");
    });

    socket.on("rps-room-state", renderState);

    socket.on("opponent-left", () => {
        message.textContent =
            "Your friend disconnected. Please create a new room to play again.";

        game.hidden = true;
        roomState = null;
        roomCode = null;
        submitted = false;
        setLobbyEnabled(true);
    });

    socket.on("connect_error", () => {
        message.textContent =
            "Unable to connect to the server. Please refresh and try again.";
    });
}


"use strict";

function startRockPaperScissors(container) {
    let socket = null;
    let mode = "menu";
    let roomState = null;
    let soloRound = 1;
    let soloScore = { wins: 0, losses: 0, draws: 0 };
    let submitted = false;

    const options = [
        { name: "Rock", emoji: "✊" },
        { name: "Paper", emoji: "✋" },
        { name: "Scissors", emoji: "✌️" }
    ];

    container.innerHTML = `
        <div class="game-center">
            <div id="rps-menu">
                <p class="game-stat">CHOOSE YOUR GAME MODE</p>
                <button id="rps-solo" class="game-action">🎮 Play Solo vs Computer</button>
                <button id="rps-create" class="game-action">👥 Create Room</button>

                <p class="game-stat">OR JOIN YOUR FRIEND'S ROOM</p>
                <label for="rps-name">Your name</label>
                <input id="rps-name" class="guess-input" maxlength="16"
                       placeholder="Enter your name">
                <input id="rps-code" class="guess-input" maxlength="5"
                       placeholder="5-character room code"
                       style="text-transform:uppercase">
                <button id="rps-join" class="game-action">Join Room</button>
                <p id="rps-message" class="game-message">
                    Play against the computer or invite a friend with a room code.
                </p>
            </div>

            <div id="rps-play" hidden>
                <p id="rps-mode" class="game-stat"></p>
                <p id="rps-room" class="game-stat"></p>
                <p id="rps-players" class="game-stat"></p>
                <p id="rps-round" class="game-stat"></p>
                <p id="rps-score" class="game-stat"></p>

                <p class="game-stat">CHOOSE YOUR MOVE</p>
                <div class="choice-row">
                    ${options.map(option => `
                        <button class="choice-btn" data-choice="${option.name}"
                                aria-label="${option.name}" title="${option.name}">
                            ${option.emoji}
                        </button>
                    `).join("")}
                </div>

                <p id="rps-status" class="game-message"></p>
                <p id="rps-result" class="game-stat"></p>
                <button id="rps-next" class="game-action" hidden>Next Round →</button>
                <button id="rps-back" class="game-action">Back to Menu</button>
            </div>
        </div>
    `;

    const $ = selector => container.querySelector(selector);
    const menu = $("#rps-menu");
    const playArea = $("#rps-play");
    const message = $("#rps-message");

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
        roomState = null;
        submitted = false;
        menu.hidden = false;
        playArea.hidden = true;
        message.textContent = "Choose Solo, create a room, or join a room.";
    }

    function setChoiceButtonsDisabled(disabled) {
        container.querySelectorAll("[data-choice]").forEach(button => {
            button.disabled = disabled;
        });
    }

    function getResult(player, computer) {
        if (player === computer) return "draw";

        const beats = {
            Rock: "Scissors",
            Paper: "Rock",
            Scissors: "Paper"
        };

        return beats[player] === computer ? "win" : "loss";
    }

    function startSolo() {
        closeSocket();
        mode = "solo";
        roomState = null;
        soloRound = 1;
        soloScore = { wins: 0, losses: 0, draws: 0 };

        showPlayArea();
        $("#rps-mode").textContent = "SOLO MODE · YOU VS COMPUTER";
        $("#rps-room").textContent = "";
        $("#rps-players").textContent = "Choose your move!";
        $("#rps-round").textContent = "ROUND 1";
        $("#rps-score").textContent = "Wins: 0 · Losses: 0 · Draws: 0";
        $("#rps-status").textContent = "Make your move!";
        $("#rps-result").textContent = "";
        $("#rps-next").hidden = true;

        setChoiceButtonsDisabled(false);
    }

    function playSoloRound(choice) {
        if (mode !== "solo") return;

        const computer = options[Math.floor(Math.random() * options.length)].name;
        const result = getResult(choice, computer);
        const emoji = name => options.find(option => option.name === name)?.emoji || "";

        if (result === "win") soloScore.wins++;
        else if (result === "loss") soloScore.losses++;
        else soloScore.draws++;

        $("#rps-mode").textContent = "SOLO MODE · YOU VS COMPUTER";
        $("#rps-players").textContent =
            `You: ${emoji(choice)} ${choice}  |  Computer: ${emoji(computer)} ${computer}`;
        $("#rps-round").textContent = `ROUND ${soloRound}`;
        $("#rps-score").textContent =
            `Wins: ${soloScore.wins} · Losses: ${soloScore.losses} · Draws: ${soloScore.draws}`;

        $("#rps-status").textContent = result === "win"
            ? "🎉 You win this round!"
            : result === "loss"
                ? "🤖 Computer wins this round!"
                : "🤝 It's a draw!";

        $("#rps-result").textContent = "Choose Next Round to continue.";
        $("#rps-next").hidden = false;
        $("#rps-next").textContent = "Play Next Round →";

        soloRound++;
        setChoiceButtonsDisabled(true);
    }

    function connectMultiplayer() {
        closeSocket();
        mode = "multiplayer";
        socket = io();

        socket.on("connect_error", () => {
            message.textContent = "Cannot connect to the game server. Please try again.";
        });

        socket.on("rps-room-state", state => {
            if (mode !== "multiplayer") return;

            roomState = state;
            const myId = state.myId;
            const myChoice = state.choices.find(player => player.id === myId);
            submitted = Boolean(myChoice?.submitted);

            showPlayArea();
            $("#rps-mode").textContent = "MULTIPLAYER · PLAY WITH A FRIEND";
            $("#rps-room").textContent = `ROOM CODE: ${state.code} · Share with your friend`;
            $("#rps-players").textContent = state.players
                .map(player => player.name + (player.id === myId ? " (You)" : ""))
                .join(" vs ");
            $("#rps-round").textContent = `ROUND ${state.round}`;
            $("#rps-score").textContent = state.players
                .map(player => `${player.name}: ${state.scores[player.id] ?? 0}`)
                .join(" | ");

            if (state.status === "waiting") {
                $("#rps-status").textContent = "Waiting for your friend to join…";
            } else if (state.status === "playing") {
                $("#rps-status").textContent = submitted
                    ? "Your move is locked. Waiting for your friend…"
                    : "Choose Rock, Paper, or Scissors!";
            } else {
                $("#rps-status").textContent = state.result?.text || "Round complete!";
            }

            $("#rps-result").textContent = state.status === "result"
                ? state.choices.map(player => {
                    const emoji = options.find(option => option.name === player.choice)?.emoji || "";
                    return `${player.name}: ${emoji} ${player.choice}`;
                }).join(" | ")
                : state.choices.some(player => player.submitted)
                    ? "A player has selected a move."
                    : "";

            $("#rps-next").hidden = state.status !== "result";
            $("#rps-next").textContent = "Next Round →";
            setChoiceButtonsDisabled(state.status !== "playing" || submitted);

            message.textContent = `Connected to room ${state.code}.`;
        });

        socket.on("opponent-left", () => {
            $("#rps-status").textContent =
                "Your friend disconnected. Return to menu to start a new room.";
            $("#rps-next").hidden = true;
            setChoiceButtonsDisabled(true);
        });
    }

    function createRoom() {
        const name = $("#rps-name").value.trim();

        if (!name) {
            message.textContent = "Please enter your name first.";
            $("#rps-name").focus();
            return;
        }

        connectMultiplayer();

        socket.emit("rps-create-room", name, response => {
            if (response?.error) message.textContent = response.error;
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

        connectMultiplayer();

        socket.emit("rps-join-room", { name, code }, response => {
            if (response?.error) message.textContent = response.error;
        });
    }

    container.querySelectorAll("[data-choice]").forEach(button => {
        button.addEventListener("click", () => {
            const choice = button.dataset.choice;

            if (mode === "solo") {
                playSoloRound(choice);
                return;
            }

            if (
                mode === "multiplayer" &&
                socket &&
                roomState?.status === "playing" &&
                !submitted
            ) {
                submitted = true;
                setChoiceButtonsDisabled(true);
                socket.emit("rps-make-choice", choice);
            }
        });
    });

    $("#rps-solo").addEventListener("click", startSolo);
    $("#rps-create").addEventListener("click", createRoom);
    $("#rps-join").addEventListener("click", joinRoom);
    $("#rps-back").addEventListener("click", backToMenu);

    $("#rps-code").addEventListener("input", event => {
        event.target.value = event.target.value.toUpperCase()
            .replace(/[^A-Z0-9]/g, "").slice(0, 5);
    });

    $("#rps-next").addEventListener("click", () => {
        if (mode === "solo") {
            $("#rps-round").textContent = `ROUND ${soloRound}`;
            $("#rps-players").textContent = "Choose your move!";
            $("#rps-status").textContent = "Make your move!";
            $("#rps-result").textContent = "";
            $("#rps-next").hidden = true;
            setChoiceButtonsDisabled(false);
        } else if (
            mode === "multiplayer" &&
            socket &&
            roomState?.status === "result"
        ) {
            socket.emit("rps-next-round");
        }
    });
}

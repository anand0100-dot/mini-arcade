
"use strict";

function startMemoryMatch(container, recordGame) {
    const symbols = ["🚀", "🎮", "🌟", "🎯", "🚀", "🎮", "🌟", "🎯"];
    let cards = [];
    let first = null;
    let second = null;
    let locked = false;
    let moves = 0;
    let matches = 0;
    let started = false;
    let startTime = 0;
    let completed = false;
    let timeoutId = null;

    function shuffle(items) {
        const result = [...items];

        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }

        return result;
    }

    container.innerHTML = `
        <div class="game-center">
            <p class="game-stat" id="memory-status">Moves: 0 · Matches: 0/4</p>
            <div class="memory-board" id="memory-board"></div>
            <p class="game-message" id="memory-message">Find all four pairs!</p>
            <button class="game-action" id="memory-reset">Restart Game</button>
        </div>
    `;

    const board = container.querySelector("#memory-board");
    const status = container.querySelector("#memory-status");
    const message = container.querySelector("#memory-message");

    function render() {
        board.replaceChildren();

        cards.forEach((card, index) => {
            const button = document.createElement("button");
            button.className = "memory-card";
            button.textContent = card.open || card.matched ? card.symbol : "?";
            button.setAttribute("aria-label", card.open || card.matched ? card.symbol : "Hidden card");
            button.disabled = card.matched || locked || card.open;

            if (card.matched) button.classList.add("matched");

            button.addEventListener("click", () => flip(index));
            board.appendChild(button);
        });

        status.textContent = `Moves: ${moves} · Matches: ${matches}/4`;
    }

    function flip(index) {
        if (locked || completed || cards[index].open || cards[index].matched) return;

        if (!started) {
            started = true;
            startTime = Date.now();
        }

        cards[index].open = true;

        if (first === null) {
            first = index;
            render();
            return;
        }

        second = index;
        moves++;

        if (cards[first].symbol === cards[second].symbol) {
            cards[first].matched = true;
            cards[second].matched = true;
            matches++;
            first = null;
            second = null;

            if (matches === 4) {
                completed = true;
                const seconds = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
                message.textContent = `Completed in ${moves} moves and ${seconds} seconds!`;
                recordGame(Math.max(1, 100 - moves * 5 - Math.floor(seconds / 5)));
            }
        } else {
            locked = true;
            render();

            timeoutId = setTimeout(() => {
                cards[first].open = false;
                cards[second].open = false;
                first = null;
                second = null;
                locked = false;
                render();
            }, 750);
        }

        render();
    }

    function reset() {
        if (timeoutId !== null) clearTimeout(timeoutId);
        timeoutId = null;
        cards = shuffle(symbols).map(symbol => ({
            symbol, open: false, matched: false
        }));
        first = null;
        second = null;
        locked = false;
        moves = 0;
        matches = 0;
        started = false;
        startTime = 0;
        completed = false;
        message.textContent = "Find all four pairs!";
        render();
    }

    container.querySelector("#memory-reset").addEventListener("click", reset);
    reset();
}


"use strict";

const modal = document.getElementById("game-modal");
const gameContent = document.getElementById("game-content");
const modalTitle = document.getElementById("modal-title");
const closeModalButton = document.getElementById("close-modal");

const STORAGE_KEY = "miniArcadeStats";

function getStats() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return data && typeof data === "object"
            ? { played: Number(data.played) || 0, best: Number(data.best) || 0 }
            : { played: 0, best: 0 };
    } catch {
        return { played: 0, best: 0 };
    }
}

function updateStats(points = 0) {
    const stats = getStats();
    stats.played += 1;
    stats.best = Math.max(stats.best, points);

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (error) {
        console.warn("Could not save scores in browser storage.", error);
    }

    renderStats();
}

function renderStats() {
    const stats = getStats();
    document.getElementById("games-played").textContent =
        String(stats.played).padStart(2, "0");
    document.getElementById("best-score").textContent =
        String(stats.best).padStart(2, "0");
}

const gameNames = {
    "tic-tac-toe": "Tic-Tac-Toe",
    "rock-paper-scissors": "Rock Paper Scissors",
    "memory-match": "Memory Match",
    "number-guessing": "Number Guessing"
};

const gameLaunchers = {
    "tic-tac-toe": () => startTicTacToe(gameContent, updateStats),
    "rock-paper-scissors": () => startRockPaperScissors(gameContent, updateStats),
    "memory-match": () => startMemoryMatch(gameContent, updateStats),
    "number-guessing": () => startNumberGuessing(gameContent, updateStats)
};

function openGame(game) {
    if (!gameLaunchers[game]) return;

    modalTitle.textContent = gameNames[game];
    gameContent.replaceChildren();
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    gameLaunchers[game]();
}

function closeGame() {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    gameContent.replaceChildren();
}

document.querySelectorAll("[data-game]").forEach(button => {
    button.addEventListener("click", () => openGame(button.dataset.game));
});

closeModalButton.addEventListener("click", closeGame);

modal.addEventListener("click", event => {
    if (event.target === modal) closeGame();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
        closeGame();
    }
});

renderStats();

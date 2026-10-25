
"use strict";

function startNumberGuessing(container, recordGame) {
    let target;
    let attempts;
    let finished;

    container.innerHTML = `
        <div class="game-center">
            <p class="game-stat">Guess a number between 1 and 100.</p>
            <label for="guess-input">Your guess</label>
            <input class="guess-input" id="guess-input" type="number" min="1" max="100" placeholder="Enter a number">
            <button class="game-action" id="guess-submit">Check Guess</button>
            <p class="game-message" id="guess-message">Can you find the secret number?</p>
            <p class="game-stat" id="guess-attempts">Attempts: 0</p>
            <button class="game-action" id="guess-reset">New Game</button>
        </div>
    `;

    const input = container.querySelector("#guess-input");
    const submit = container.querySelector("#guess-submit");
    const message = container.querySelector("#guess-message");
    const attemptLabel = container.querySelector("#guess-attempts");

    function reset() {
        target = Math.floor(Math.random() * 100) + 1;
        attempts = 0;
        finished = false;
        input.value = "";
        input.disabled = false;
        submit.disabled = false;
        message.textContent = "Can you find the secret number?";
        attemptLabel.textContent = "Attempts: 0";
    }

    function guess() {
        if (finished) return;

        const value = Number(input.value);

        if (input.value.trim() === "" || !Number.isInteger(value) || value < 1 || value > 100) {
            message.textContent = "Enter a whole number from 1 to 100.";
            return;
        }

        attempts++;
        attemptLabel.textContent = `Attempts: ${attempts}`;

        if (value === target) {
            finished = true;
            message.textContent = `Correct! You found ${target} in ${attempts} attempts! 🎉`;
            input.disabled = true;
            submit.disabled = true;
            recordGame(Math.max(1, 100 - (attempts - 1) * 10));
        } else {
            message.textContent = value < target
                ? "Too low! Try a higher number."
                : "Too high! Try a lower number.";
        }

        input.value = "";
        if (!finished) input.focus();
    }

    submit.addEventListener("click", guess);
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") guess();
    });
    container.querySelector("#guess-reset").addEventListener("click", reset);

    reset();
}


"use strict";

// ---------- Calculator state ----------
let expression = "";
let justCalculated = false;
let historyItems = [];

const expressionEl = document.getElementById("expression");
const resultEl = document.getElementById("result");
const historyEl = document.getElementById("history");
const answerEl = document.getElementById("assistantAnswer");

// ---------- Safe math parser ----------
// Supports +, -, *, /, %, parentheses and unary minus.
// Does not execute the user's input as JavaScript.

function tokenize(input) {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    if (/\s/.test(input[i])) {
      i++;
      continue;
    }

    const rest = input.slice(i);
    const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);

    if (number) {
      tokens.push({ type: "number", value: Number(number[0]) });
      i += number[0].length;
    } else if ("+-*/()%".includes(input[i])) {
      tokens.push({ type: input[i], value: input[i] });
      i++;
    } else {
      throw new Error("Unsupported character");
    }
  }

  if (tokens.length > 300) {
    throw new Error("Expression is too long");
  }

  return tokens;
}

function calculate(input) {
  const tokens = tokenize(input);
  let position = 0;

  function primary() {
    const token = tokens[position];

    if (!token) throw new Error("Incomplete expression");

    if (token.type === "number") {
      position++;
      return token.value;
    }

    if (token.type === "+" || token.type === "-") {
      position++;
      const value = primary();
      return token.type === "-" ? -value : value;
    }

    if (token.type === "(") {
      position++;
      const value = addSub();
      if (tokens[position]?.type !== ")") {
        throw new Error("Missing closing bracket");
      }
      position++;
      return value;
    }

    throw new Error("Invalid expression");
  }

  function postfix() {
    let value = primary();

    // Calculator convention: 50% means 0.5.
    while (tokens[position]?.type === "%") {
      position++;
      value /= 100;
    }

    return value;
  }

  function multiplyDivide() {
    let value = postfix();

    while (
      tokens[position]?.type === "*" ||
      tokens[position]?.type === "/"
    ) {
      const operator = tokens[position++].type;
      const right = postfix();

      if (operator === "/" && right === 0) {
        throw new Error("Cannot divide by zero");
      }

      value = operator === "*" ? value * right : value / right;
    }

    return value;
  }

  function addSub() {
    let value = multiplyDivide();

    while (
      tokens[position]?.type === "+" ||
      tokens[position]?.type === "-"
    ) {
      const operator = tokens[position++].type;
      const right = multiplyDivide();

      value = operator === "+" ? value + right : value - right;
    }

    return value;
  }

  if (!tokens.length) throw new Error("Enter a calculation");

  const value = addSub();

  if (position !== tokens.length) {
    throw new Error("Check your expression");
  }

  if (!Number.isFinite(value)) {
    throw new Error("Result is too large");
  }

  return Object.is(value, -0) ? 0 : value;
}

function format(value) {
  return Number(value.toPrecision(12)).toLocaleString("en-US", {
    maximumFractionDigits: 10
  });
}

function updateDisplay() {
  expressionEl.textContent = expression || "0";

  if (!expression) {
    resultEl.textContent = "0";
    return;
  }

  try {
    resultEl.textContent = format(calculate(expression));
  } catch {
    resultEl.textContent = "…";
  }
}

// ---------- Calculator buttons ----------

function addValue(value) {
  const operators = ["+", "-", "*", "/"];

  if (justCalculated) {
    if (operators.includes(value)) {
      // Continue calculating from the previous answer.
      expression = String(calculate(expression));
    } else {
      expression = "";
    }
    justCalculated = false;
  }

  const last = expression.slice(-1);

  if (operators.includes(value)) {
    if (!expression && value !== "-") return;

    if (operators.includes(last)) {
      expression = expression.slice(0, -1);
    }
  }

  if (value === ".") {
    const currentNumber = expression.split(/[+\-*/()%]/).pop();
    if (currentNumber.includes(".")) return;
  }

  if (value === "(" && /\d|\)/.test(last)) {
    expression += "*";
  }

  if (value === ")" && !expression) return;

  expression += value;
  updateDisplay();
}

function showError(message) {
  resultEl.textContent = message;
}

function equals() {
  if (!expression) return;

  try {
    const original = expression;
    const value = calculate(original);

    historyItems.unshift({
      expression: original,
      result: format(value)
    });

    historyItems = historyItems.slice(0, 8);
    renderHistory();

    expression = String(value);
    justCalculated = true;
    updateDisplay();
  } catch (error) {
    showError(error.message || "Invalid calculation");
  }
}

function renderHistory() {
  historyEl.replaceChildren();

  if (!historyItems.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Your calculations will appear here.";
    historyEl.append(li);
    return;
  }

  historyItems.forEach(item => {
    const li = document.createElement("li");
    const left = document.createElement("span");
    const right = document.createElement("span");

    left.textContent = item.expression + " =";
    right.textContent = item.result;
    right.className = "history-value";

    li.append(left, right);
    li.title = "Click to reuse this result";
    li.tabIndex = 0;
    li.setAttribute("role", "button");

    function reuse() {
      expression = item.result.replaceAll(",", "");
      justCalculated = true;
      updateDisplay();
    }

    li.addEventListener("click", reuse);
    li.addEventListener("keydown", event => {
      if (event.key === "Enter") reuse();
    });

    historyEl.append(li);
  });
}

document.getElementById("keypad").addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;

  const { value, action } = button.dataset;

  if (value !== undefined) {
    addValue(value);
    return;
  }

  if (action === "clear") {
    expression = "";
    justCalculated = false;
    updateDisplay();
  }

  if (action === "delete") {
    expression = expression.slice(0, -1);
    justCalculated = false;
    updateDisplay();
  }

  if (action === "equals") equals();

  if (action === "sqrt" || action === "square" || action === "sign") {
    try {
      const value = calculate(expression);
      let next;

      if (action === "sqrt") {
        if (value < 0) throw new Error("Square root needs a non-negative number");
        next = Math.sqrt(value);
      }

      if (action === "square") next = value * value;
      if (action === "sign") next = -value;

      if (!Number.isFinite(next)) throw new Error("Result is too large");

      expression = String(next);
      justCalculated = true;
      updateDisplay();
    } catch (error) {
      showError(error.message || "Enter a valid number first");
    }
  }
});

// Keyboard support
document.addEventListener("keydown", event => {
  if (event.target.matches("input")) return;

  if (/^[0-9.+\-*/()%]$/.test(event.key)) {
    addValue(event.key);
  } else if (event.key === "Enter" || event.key === "=") {
    equals();
  } else if (event.key === "Backspace") {
    expression = expression.slice(0, -1);
    justCalculated = false;
    updateDisplay();
  } else if (event.key === "Escape") {
    expression = "";
    justCalculated = false;
    updateDisplay();
  }
});

document.getElementById("clearHistory").addEventListener("click", () => {
  historyItems = [];
  renderHistory();
});

// ---------- Theme switch ----------

document.getElementById("themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("light");

  document.getElementById("themeBtn").textContent =
    document.body.classList.contains("light") ? "☾" : "☀";
});

// ---------- Smart math assistant ----------

function smartAnswer(question) {
  const q = question.toLowerCase().trim();
  let match;

  // Example: "What is 15% of 2400?"
  match = q.match(
    /(-?\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:of)\s*(-?\d+(?:\.\d+)?)/
  );

  if (match) {
    const percentage = Number(match[1]);
    const amount = Number(match[2]);
    const answer = percentage / 100 * amount;

    return `${percentage}% of ${amount} = ${format(answer)}.\n\n` +
      `Step 1: Convert the percentage to a decimal: ${percentage}/100.\n` +
      `Step 2: Multiply ${format(percentage / 100)} × ${amount}.\n` +
      `Answer: ${format(answer)}.`;
  }

  // Example: "square root of 144"
  match = q.match(/(?:square root of|sqrt)\s*(-?\d+(?:\.\d+)?)/);

  if (match) {
    const number = Number(match[1]);

    if (number < 0) return "Please enter a non-negative number.";

    return `The square root of ${number} is ${format(Math.sqrt(number))}.`;
  }

  // Example: "25 squared"
  match = q.match(/(-?\d+(?:\.\d+)?)\s*(?:squared|to the power of 2)/);

  if (match) {
    const number = Number(match[1]);

    return `${number}² = ${format(number * number)}.\n\n` +
      `Multiply ${number} × ${number} to get the answer.`;
  }

  // Example: "12 plus 8" or "12 divided by 3"
  const normalized = q
    .replace(/what is|calculate|please|how much is|\?/g, "")
    .replace(/\bplus\b/g, "+")
    .replace(/\bminus\b/g, "-")
    .replace(/\bmultiplied by\b|\btimes\b|\bx\b/g, "*")
    .replace(/\bdivided by\b/g, "/")
    .trim();

  if (/^[\d\s.+\-*/()%]+$/.test(normalized) && /\d/.test(normalized)) {
    try {
      const answer = calculate(normalized);
      return `The answer is ${format(answer)}.\n\n` +
        `Calculation: ${normalized} = ${format(answer)}.`;
    } catch {
      return "I couldn't calculate that. Check your numbers and operators.";
    }
  }

  return "I can currently solve percentages, square roots, squares, and basic arithmetic. " +
    "Try: 'What is 15% of 2400?' or '25 squared'.";
}

function displayAnswer(text) {
  answerEl.replaceChildren();

  const label = document.createElement("span");
  label.className = "answer-label";
  label.textContent = "ASSISTANT";

  const paragraph = document.createElement("p");
  paragraph.style.whiteSpace = "pre-line";
  paragraph.textContent = text;

  answerEl.append(label, paragraph);
}

document.getElementById("assistantForm").addEventListener("submit", event => {
  event.preventDefault();

  const input = document.getElementById("question");
  const question = input.value.trim();

  if (!question) return;

  displayAnswer(smartAnswer(question));
});

document.querySelectorAll("[data-prompt]").forEach(button => {
  button.addEventListener("click", () => {
    const input = document.getElementById("question");
    input.value = button.dataset.prompt;
    document.getElementById("assistantForm").requestSubmit();
  });
});

// Initial display
updateDisplay();
renderHistory();

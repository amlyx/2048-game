const size = 4;
const winValue = 2048;
const storageKey = "codex-2048-best-score";

const boardElement = document.querySelector("#board");
const scoreElement = document.querySelector("#score");
const bestScoreElement = document.querySelector("#bestScore");
const statusElement = document.querySelector("#status");
const newGameButton = document.querySelector("#newGame");

let board = [];
let score = 0;
let bestScore = Number(localStorage.getItem(storageKey) || 0);
let won = false;
let over = false;
let lastNewCell = null;
let mergedCells = new Set();
let pointerStart = null;

function makeEmptyBoard() {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function setupCells() {
  boardElement.innerHTML = "";
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cell = document.createElement("div");
      cell.className = "tile";
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      boardElement.append(cell);
    }
  }
}

function getEmptyCells() {
  const cells = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (board[row][col] === 0) {
        cells.push({ row, col });
      }
    }
  }
  return cells;
}

function addRandomTile() {
  const emptyCells = getEmptyCells();
  if (emptyCells.length === 0) return;

  const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  board[cell.row][cell.col] = Math.random() < 0.9 ? 2 : 4;
  lastNewCell = `${cell.row}-${cell.col}`;
}

function startGame() {
  board = makeEmptyBoard();
  score = 0;
  won = false;
  over = false;
  lastNewCell = null;
  mergedCells = new Set();
  addRandomTile();
  addRandomTile();
  render();
  boardElement.focus();
}

function render() {
  const cells = boardElement.querySelectorAll(".tile");
  cells.forEach((cell) => {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const value = board[row][col];
    const key = `${row}-${col}`;

    cell.textContent = value ? String(value) : "";
    cell.dataset.value = value ? String(value) : "";
    cell.className = "tile";
    if (value) cell.classList.add("filled");
    if (key === lastNewCell) cell.classList.add("new");
    if (mergedCells.has(key)) cell.classList.add("merged");
  });

  scoreElement.textContent = String(score);
  bestScoreElement.textContent = String(bestScore);
  statusElement.textContent = getStatusText();
}

function getStatusText() {
  if (over) return "没有可移动的格子了";
  if (won) return "你合成了 2048";
  return "方向键或滑动移动";
}

function compressLine(line) {
  const values = line.filter(Boolean);
  const result = [];
  const mergeIndexes = [];
  let gained = 0;

  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === values[index + 1]) {
      const merged = values[index] * 2;
      result.push(merged);
      mergeIndexes.push(result.length - 1);
      gained += merged;
      index += 1;
    } else {
      result.push(values[index]);
    }
  }

  while (result.length < size) result.push(0);
  return { line: result, gained, mergeIndexes };
}

function move(direction) {
  if (over) return;

  const nextBoard = makeEmptyBoard();
  const nextMergedCells = new Set();
  let changed = false;
  let gained = 0;

  for (let index = 0; index < size; index += 1) {
    const line = readLine(index, direction);
    const compressed = compressLine(line);
    gained += compressed.gained;

    compressed.line.forEach((value, lineIndex) => {
      const { row, col } = coordinatesFor(index, lineIndex, direction);
      nextBoard[row][col] = value;
      if (compressed.mergeIndexes.includes(lineIndex)) {
        nextMergedCells.add(`${row}-${col}`);
      }
    });

    if (line.some((value, lineIndex) => value !== compressed.line[lineIndex])) {
      changed = true;
    }
  }

  if (!changed) return;

  board = nextBoard;
  score += gained;
  bestScore = Math.max(bestScore, score);
  localStorage.setItem(storageKey, String(bestScore));
  mergedCells = nextMergedCells;
  lastNewCell = null;
  if (board.flat().includes(winValue)) won = true;
  addRandomTile();
  over = !canMove();
  render();
}

function readLine(index, direction) {
  const line = [];
  for (let offset = 0; offset < size; offset += 1) {
    const { row, col } = coordinatesFor(index, offset, direction);
    line.push(board[row][col]);
  }
  return line;
}

function coordinatesFor(index, offset, direction) {
  if (direction === "left") return { row: index, col: offset };
  if (direction === "right") return { row: index, col: size - 1 - offset };
  if (direction === "up") return { row: offset, col: index };
  return { row: size - 1 - offset, col: index };
}

function canMove() {
  if (getEmptyCells().length > 0) return true;

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const value = board[row][col];
      if (board[row]?.[col + 1] === value || board[row + 1]?.[col] === value) {
        return true;
      }
    }
  }

  return false;
}

function handleKeydown(event) {
  const keyMap = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
  };

  const direction = keyMap[event.key];
  if (!direction) return;
  event.preventDefault();
  move(direction);
}

function handlePointerDown(event) {
  pointerStart = { x: event.clientX, y: event.clientY };
}

function handlePointerUp(event) {
  if (!pointerStart) return;

  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    move(dx > 0 ? "right" : "left");
  } else {
    move(dy > 0 ? "down" : "up");
  }
}

setupCells();
startGame();

newGameButton.addEventListener("click", startGame);
document.addEventListener("keydown", handleKeydown);
boardElement.addEventListener("pointerdown", handlePointerDown);
boardElement.addEventListener("pointerup", handlePointerUp);

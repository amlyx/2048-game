const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Element {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.className = "";
    this.textContent = "";
    this.listeners = {};
    this.classList = {
      add: (...names) => {
        const current = new Set(this.className.split(" ").filter(Boolean));
        names.forEach((name) => current.add(name));
        this.className = [...current].join(" ");
      },
    };
  }

  append(child) {
    this.children.push(child);
  }

  focus() {}

  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }

  querySelectorAll(selector) {
    return selector === ".tile" ? this.children : [];
  }

  set innerHTML(value) {
    this.children = [];
  }
}

function createGame() {
  const elements = {
    "#board": new Element(),
    "#score": new Element(),
    "#bestScore": new Element(),
    "#status": new Element(),
    "#newGame": new Element(),
  };

  const context = {
    console,
    localStorage: {
      data: {},
      getItem(key) {
        return this.data[key] ?? null;
      },
      setItem(key, value) {
        this.data[key] = String(value);
      },
    },
    document: {
      querySelector(selector) {
        return elements[selector];
      },
      createElement() {
        return new Element();
      },
      addEventListener() {},
    },
    Math: Object.create(Math),
  };

  context.Math.random = () => 0;
  vm.createContext(context);
  const code = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
  vm.runInContext(code, context);
  return context;
}

function readJson(game, expression) {
  return JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, game));
}

{
  const game = createGame();
  vm.runInContext(
    "board = [[2,2,4,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]; score = 0; over = false; move('left');",
    game,
  );

  assert.deepEqual(readJson(game, "board[0]"), [4, 4, 2, 0]);
  assert.equal(vm.runInContext("score", game), 4);
}

{
  const game = createGame();
  vm.runInContext(
    "board = [[2,2,2,2],[0,0,0,0],[0,0,0,0],[0,0,0,0]]; score = 0; over = false; move('left');",
    game,
  );

  assert.deepEqual(readJson(game, "board[0]"), [4, 4, 2, 0]);
  assert.equal(vm.runInContext("score", game), 8);
}

{
  const game = createGame();
  vm.runInContext(
    "board = [[2,4,8,16],[32,64,128,256],[512,1024,2,4],[8,16,32,64]]; over = false; move('left');",
    game,
  );

  assert.equal(vm.runInContext("over", game), false);
  assert.deepEqual(readJson(game, "board"), [
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [512, 1024, 2, 4],
    [8, 16, 32, 64],
  ]);
}

{
  const game = createGame();
  vm.runInContext(
    "board = [[0,2,4,8],[16,32,64,128],[256,512,1024,2],[4,8,16,32]]; over = false; move('left');",
    game,
  );

  assert.equal(vm.runInContext("over", game), true);
}

console.log("All game tests passed");

"use strict";
let logBoard = false;

// for async functions
async function pause(ms) {
   return await new Promise(resolve => setTimeout(resolve, ms, "Done!"));
}

Array.prototype.valuesEqual = function valuesEqual(arr) {
   if (!Array.isArray(arr) || this.length !== arr.length)
      return false;
   
   for (let i = 0; i < this.length; i++)
      if (Array.isArray(this[i]) && Array.isArray(arr[i]) && !this[i].valuesEqual(arr[i]))
         return false;
      else if (this[i] !== arr[i])
         return false;
   return true;
}


class CustomError extends Error {
   get name() { return this.constructor.name } // For ease of maintenance
}

class ElementError extends CustomError {
   constructor (element = document.createElement('HTMLUnknownElement'), message) {
      super(message);
      this.element = element;
   }
}

class NothingDisabledError extends CustomError {
   constructor (noun = "Nothing", plural, message) {
      super(message ?? `Cannot enable ${noun} since all ${plural ?? `${noun}s`} are already enabled.`);
   }
}

class NothingEnabledError extends CustomError {
   constructor (noun = "Nothing", plural, message) {
      super(message ?? `Cannot disable ${noun} since all ${plural ?? `${noun}s`} are already disabled.`);
   }
}

// params = (string, string)
// do not pass "null" into condition
class DisabledError extends CustomError {
   constructor (noun, condition = '') {
      if (condition.length !== 0) condition = ` and ${condition}`;

      super(`${noun} is disabled${condition}.`);
   }
}

class BotIsDisabledError extends DisabledError {
   constructor (bot) {
      super(bot.name, 'cannot play');
      this.bot = bot;
   }
}

class ElementIsDisabledError extends DisabledError {
   constructor (element, message = "shouldn't be changed") {
      super(element.tagName, message);
      this.element = element;
   }
}

class ElementAlreadyError extends ElementError {
   constructor (element, isAlreadyWhat) {
      super(element, `${element.tagName} element is already ${isAlreadyWhat}`);
   }
}

class ElementIsAlreadyDisabledError extends ElementAlreadyError {
   constructor (element) {
      super(element, "disabled");
   }
}

class ElementIsAlreadyEnabledError extends ElementAlreadyError {
   constructor (element) {
      super(element, "enabled");
   }
}

// When an internal value is wrong
class InvalidValueError extends CustomError {
   constructor (valueName, message) {
      super(message ?? `${valueName ? "Some" : "The"} internal value (${valueName ?? "name not provided"}) was invalid`);
   }
}

class MaxValueError extends InvalidValueError {
   constructor (message = "Max value reached") {
      super(message);
   }
}

class SameValuesError extends CustomError {
   constructor (message = "Some values are the same when they shouldn't be") {
      super(message);
   }
}

class DidntChangeError extends SameValuesError {
   constructor (message = 'Something "changed" to the same value') {
      super(message);
   }
}

// When the user does something the user isn't supposed to
class EvilPlayerError extends CustomError {
   constructor (message = 'hmmph') {
      super(message);
   }
}

// Only for constant non-default errors
const ERRORS = {
   CONST_MAX_LENGTH: new TypeError("Assignment to constant property {MAX_LENGTH}"),
   CONST_MAX_TURNS: new TypeError("Assignment to constant property {MAX_TURNS}"),
   SQUARE_NOT_UPDATED: new InvalidValueError("square", "AAA WHAT!????"),
   INVALID_MOVE_FINISH: new InvalidValueError("moveFinish"),
   IMPOSSIBLE_LAST_MOVE: new ReferenceError("Last move was not an option...?"),
   MAX_PLAYERS_REACHED: new MaxValueError("Max players reached"),
   EVERYONEs_ENABLED: new NothingDisabledError("person", "people"),
   NO_ONEs_ENABLED: new NothingEnabledError("person", "people"),
   EVIL_CLICK: new EvilPlayerError("Hey, you're not supposed to click that"),
   EVIL_CHANGE: new EvilPlayerError("How did you do that"),
};
const NOT_DONE_YET = "This feature is not finished yet. So it doesn't work";

class Position {
   constructor (x, y) {
      this.x = x;
      this.y = y;
   }

   /** Returns the manhattan distance from another position */
   distance(position) {
      return Math.abs(this.x - position.x) + Math.abs(this.y - position.y);
   }
}

class Step {
   constructor (vx, vy) {
      this.vx = vx;
      this.vy = vy;
   }
}

class Cell extends Position {
   constructor (value, x, y) {
      super(x, y);
      this.value = value;
      this.win = false; // Idea: setter errors when value is '' or ' '
      this.moveIndex = null; // Index when a move is played on that square
   }
}

class Move extends Position {
   // Due to the unique position of the constructor in Game.update:
      // x, y: updated
      // game.moveHistory: latest move is the one before this move
   constructor (oldXY, newXY, game = currentGame) {
      super(newXY.x, newXY.y);
      this.game = game;
      this.index = game.moveHistory.length; // must be true
      this.gameState = game.gameStates[this.index + 1];

      this.originalPosition = oldXY; // No board update
   }

   get correspondingPosition() {
      const correctPosition = new Position(this.x, this.y);

      // this.index === this.gameState.moveHistory.length
      for (let index = this.index; index < this.game.moveHistory.length; index++) {
         const nextMove = this.game.moveHistory[index].originalPosition;
         if (nextMove.x === 0) correctPosition.x++;
         if (nextMove.y === 0) correctPosition.y++;
      }
      return correctPosition;
   }

   updatedDistance(position) {
      let updatedPosition = this.correspondingPosition;
      return Math.abs(updatedPosition.x - position.x) +
             Math.abs(updatedPosition.y - position.y);
   }
}

class GameState {
   constructor (game = currentGame) {
      this.game = game;

      this.turn = game.turn;
      this.ply = game.ply;
      this.toMove = game.toMove;
      this.result = game.result;
      this.board = [];
      this.board.width = game.board.width;
      this.board.height = game.board.height;

      for (let y = 0; y < game.board.length; y++) {
         this.board.push([]);
         for (let x = 0; x < game.board.width; x++) {
            const cell = new Cell(game.board[y][x].value, y, x);
            cell.win = game.board[y][x].win;
            this.board[y].push(cell);
         }
      }

      this.moveHistory = game.moveHistory.slice();
   }

   get originalMoves() {
      const moves = [];
      for (let y = 0; y < this.board.height; y++)
         for (let x = 0; x < this.board.width; x++)
            if (this.board[y][x].value === ' ')
               moves.push(new Position(x, y));
      return moves;
   }

   get correspondingMoves() {
      let moves = this.originalMoves;
      for (let move of moves)
         for (
            let index = this.moveHistory.length;
            index < this.game.moveHistory.length;
            index++
         ) {
            const nextMove = this.game.moveHistory[index].originalPosition;
            if (nextMove.x === 0) move.x++;
            if (nextMove.y === 0) move.y++;
         }
      return moves;
   }

   getAscii() {
      return Game.prototype.getAscii.call(this);
   }

   logAscii() {
      Game.prototype.logAscii.call(this);
   }
}

class Game {
   constructor () {
      this.turn = 0; /** Starts at 0 */
      this.ply = 0;
      this.toMove = 0; // index in player array
      this.result = null;
      this.winners = [];

      this.board = [
         [new Cell(' ', 0, 0), new Cell(' ', 0, 1), new Cell(' ', 0, 2)],
         [new Cell(' ', 1, 0), new Cell(' ', 1, 1), new Cell(' ', 1, 2)],
         [new Cell(' ', 2, 0), new Cell(' ', 2, 1), new Cell(' ', 2, 2)]
      ]; // WARNING: this.board[y][x]
      this.board.width = 3;
      this.board.height = 3; // same as this.board.length

      this.visual = [];
      this.visual.offset = new Position(0, 0);
      this.visualStart();

      this.moveHistory = [];
      this.gameStates = [new GameState(this)]; // starts with the original position
   }

   // These static methods must be gotten from the class Game
   // i.e.: Game.MAX_LENGTH instead of this.MAX_LENGTH

   // TODO: Add a way to change this.
   static set MAX_LENGTH(value) { throw ERRORS.CONST_MAX_LENGTH }
   static get MAX_LENGTH() { return 511 }
   static set MAX_TURNS(value) { throw ERRORS.CONST_MAX_TURNS }
   static get MAX_TURNS() { return 314 }

   setCell(x, y, value) {
      this.board[y][x] = new Cell(value, x, y);
   }

   visualStart() {
      // the top-left of the board is 0, 0
      // second row is 1, 0
      // third row, seventh column is 3, 7

      for (let y = 0; y < this.board.length; y++)
         for (let x = 0; x < this.board.width; x++)
            if (this.board[y][x].value !== '')
               ELEMENTS.getSquare(
                  this.visual.offset.x + x,
                  this.visual.offset.y + y
               ).className = 'board';
   }

   play(x, y) {
      this.update(x, y);
      this.playBots();
      if (logBoard) this.logAscii();
   }

   async playBots() {
      if (players[this.toMove].type === "bot") {
         await pause(200);
         this.doBotMove();
      }

      if (logBoard) this.logAscii();
   }

   update(x, y) {
      console.log('move: ', x, y);

      if (this.board[y][x].value !== ' ')
         throw ERRORS.SQUARE_NOT_UPDATED;

      const oldPosition = {x, y};
      let newXY = this.updateBoard(x, y);
      x = newXY.x;
      y = newXY.y;

      let moveFinish = this.checkGameEnd(x, y);
      if (moveFinish !== false) this.updateGameEnd(moveFinish, x, y);

      this.gameStates.push(new GameState(this));
      this.moveHistory.push(new Move(oldPosition, {x, y}, this));
      players[this.toMove].lastMove = this.moveHistory[this.moveHistory.length - 1];

      // updateVisual must go after setting lastMove but before setting toMove
      if (this === currentGame) this.updateVisual();

      this.ply++;
      this.toMove = (this.toMove + 1) % players.length;
      if (this.toMove === 0) this.turn++;

      // But this must go after setting turn
      if (this === currentGame) this.updateVisualStats();

      console.log("update:", x, y, moveFinish);
   }

   updateBoard(x, y) {
      // Possible bug in the future, the else ifs assume that the
      // first cell is not the same as the last cell, which would be untrue if
      // the width or height was 1

      // Since we grow the board down at the 4 ifs,
      // the (i === x ? ' ' : '') is redundant
      if (y === 0) {
         this.board.unshift([]);
         for (let i = 0; i < this.board.width; i++)
            this.board[0].push(
               new Cell(i === x ? ' ' : '', i, 0)
            );
         this.board.height++; y++;
      } else if (y === this.board.height - 1) {
         this.board.push([]);
         this.board.height++;
         for (let i = 0; i < this.board.width; i++)
            this.board[this.board.height - 1].push(
               new Cell(i === x ? ' ' : '', i, this.board.height - 1)
            );
      }

      if (x === 0) {
         for (let i = 0; i < this.board.length; i++)
            this.board[i].unshift(
               new Cell(i === y ? ' ' : '', i, 0)
            );
         this.board.width++; x++;
      } else if (x === this.board.width - 1) {
         for (let i = 0; i < this.board.length; i++)
            this.board[i].push(
               new Cell(i === y ? ' ' : '', i, this.board.width)
            );
         this.board.width++;
      }


      if (this.board[y - 1][x].value === '') this.setCell(x, y - 1, ' ');
      if (this.board[y + 1][x].value === '') this.setCell(x, y + 1, ' ');
      if (this.board[y][x - 1].value === '') this.setCell(x - 1, y, ' ');
      if (this.board[y][x + 1].value === '') this.setCell(x + 1, y, ' ');

      this.board[y][x] = new Cell(PLAYER_CHARS[this.toMove], x, y);
      this.board[y][x].moveIndex = this.moveHistory.length;

      for (let y2 = 0; y2 < this.board.length; y2++)
         for (let x2 = 0; x2 < this.board.width; x2++) {
            this.board[y2][x2].y = y2;
            this.board[y2][x2].x = x2;
         }

      return this.board[y][x];
   }

   updateVisualStats() {
      ELEMENTS.statsParagraph.innerText =
`Width: ${this.board.width}
Height: ${this.board.height}
Turns: ${this.turn}`;
   }

   // Same as visualStart really
   updateVisual() {
      for (let y = 0; y < 20; y++)
         for (let x = 0; x < 20; x++) {
            let button = ELEMENTS.getSquare(x, y);
            let cell = this.board?.[y - this.visual.offset.y]?.[x - this.visual.offset.x];

            // undefined or empty string
            button.className = '';
            button.style.removeProperty("border-color");
            button.style.removeProperty("background-color");
            button.style.removeProperty("background-image");

            // Assumes (cell === undefined || cell.value !== undefined)
            if (cell === undefined || cell.value === '') continue;
            else button.className = 'board';

            if (cell.value !== ' ') {
               let playerIndex = PLAYER_CHARS.indexOf(cell.value);
               if (playerIndex === -1 && !cell.win)
                  button.style.backgroundColor = "red";
               else
                  button.style.backgroundImage = `url("${player_assets[playerIndex]}")`;


               button.className = 'board';
               if (cell.win)
                  button.classList.add("win");
               else if (players?.[playerIndex].lastMove?.index === cell.moveIndex)
                  button.style.borderColor = PLAYER_BORDERS[playerIndex];
            }
         }
      // Outer for doesn't need brackets
   }

   updateGameEnd(result, lastX, lastY) {
      this.result ??= result[0];
      if (result[0] === "win") {
         notice("WINNNN", result);
         for (let cell of result[1].flat().concat(this.board[lastY][lastX]))
            cell.win = true;

         let winArray = [this.toMove, PLAYER_NAMES[this.toMove], players[this.toMove].player];
         if (this.winners.every(array => !array.valuesEqual(winArray)))
            this.winners.push(winArray);
      } else if (result[0] === "draw") {
         notice(`*gasp*! Draw!\n${result[1]}`, result);
      } else
         throw ERRORS.INVALID_MOVE_FINISH;
   }

   checkGameEnd(x, y) {
      let win = this.checkWin(x, y);
      if (win) return ["win", win];

      if (this.board.width > 7 * this.board.height)
         return ["draw", "width is 7 times the height"];
      else if (this.board.height > 7 * this.board.width)
         return ["draw", "height is 7 times the width"];
      else if (this.turn >= Game.MAX_TURNS)
         return ["draw", `max turns reached (${Game.MAX_TURNS})`]
      else if (this.board.width >= Game.MAX_LENGTH)
         return ["draw", `max length reached by width (${Game.MAX_LENGTH})`]
      else if (this.board.height >= Game.MAX_LENGTH)
         return ["draw", `max length reached by height (${Game.MAX_LENGTH})`]
      else
         return false;
   }

   checkWin(x, y) {
      const playerValue = this.board[y][x].value;
      let wins = [];
      let orthogonal = [[], [], [], []];
      let diagonal = [[], [], [], []];

      // Arrow function so that "this" is not undefined
      const goDiagonal = (x2, y2, step) => {
         let diag = [this.board[y2][x2]];
         let currentPos = new Position(x2, y2);

         // eslint-disable-next-line no-constant-condition
         while (true) {
            currentPos.x += step.vx;
            currentPos.y += step.vy;
            let square = this.board[currentPos.y]?.[currentPos.x];

            if (square?.value !== playerValue) break;
            diag.push(square);
         }
         return diag;
      }

      for (let i = 0; i < 4; i++) {
         const orthogonalStep = [
            new Step(-1, 0),
            new Step(1, 0),
            new Step(0, 1),
            new Step(0, -1),
         ][i];

         const diagonalStep = [
            new Step(1, 1),
            new Step(1, -1),
            new Step(-1, 1),
            new Step(-1, -1)
         ][i];

         orthogonal[i] = goDiagonal(x, y, orthogonalStep);
         diagonal[i] = goDiagonal(x, y, diagonalStep);
      }

      // good good good n good good good
      // n 1 1 1 n 2 2 2
      function sevenNArow(oneDirection, oppositeDirection) {
         if (oneDirection.length + oppositeDirection.length >= 8)
            return oneDirection.slice(1).concat(...oppositeDirection);
         else
            return false;
      }

      function checkMark(side1, side2) {
         if (
            side1.length >= 4 && side2.length >= 2 ||
            side2.length >= 4 && side1.length >= 2
         )
            return side1.slice(1).concat(...side2);
         else
            return false;
      }

      function isValidCheckmark(side1, side2) {
         return (side1.length >= 2 && side2.length >= 4) ||
                (side1.length >= 4 && side2.length >= 2);
      }

      const sevenChecks = [
         sevenNArow(orthogonal[0], orthogonal[1]),
         sevenNArow(orthogonal[2], orthogonal[3]),
         sevenNArow(diagonal[0], diagonal[3]),
         sevenNArow(diagonal[1], diagonal[2])
      ];

      for (let sevenNArowCheck of sevenChecks)
         if (sevenNArowCheck) wins.push(sevenNArowCheck)

      const rightAngleMarkChecks = [
         checkMark(diagonal[0], diagonal[1]),
         checkMark(diagonal[0], diagonal[2]),
         checkMark(diagonal[3], diagonal[1]),
         checkMark(diagonal[3], diagonal[2]),
      ];

      for (let markCheck of rightAngleMarkChecks)
         if (markCheck) wins.push(markCheck)


      // arrow function in order to access "this"
      // arguments = diagonal, oppositeDiagonal, perpendicularStep, oppositePerpendicularStep
      const checkmarks = (diag, oppDiag, perpStep, oppPerpStep) => {
         // The way the diags work:
         // above, the squares are pushed onto the array, *away* from the xy.
         // So the diag arrays' first elements are the ones in the diag closer to the xy
         let newWins = [];

         // The checkmarks are made of the opposite diagonal,
         // plus this diagonal (minus the shared cell), which make one big side,
         // then the other perpendicular sides.
         let currBase = [...(oppDiag.slice(1)), diag[0]]; // Reordering cells
         for (let square of diag.slice(1)) {
            currBase.push(square);
            let perpDiag = goDiagonal(square.x, square.y, perpStep);
            let oppPerpDiag = goDiagonal(square.x, square.y, oppPerpStep);
            if (isValidCheckmark(currBase, perpDiag))
               newWins.push([...currBase, ...(perpDiag.slice(1))]);
            if (isValidCheckmark(currBase, oppPerpDiag))
               newWins.push([...currBase, ...(oppPerpDiag.slice(1))]);
         }

         currBase = [...(diag.slice(1)), diag[0]];
         for (let square of oppDiag.slice(1)) {
            currBase.push(square);
            let perpDiag = goDiagonal(square.x, square.y, perpStep);
            let oppPerpDiag = goDiagonal(square.x, square.y, oppPerpStep);
            if (isValidCheckmark(currBase, perpDiag))
               newWins.push([...currBase, ...(perpDiag.slice(1))]);
            if (isValidCheckmark(currBase, oppPerpDiag))
               newWins.push([...currBase, ...(oppPerpDiag.slice(1))]);
         }

         return newWins;
      }

      wins.push(...checkmarks(diagonal[0], diagonal[3], new Step(1, -1), new Step(-1, 1)));
      wins.push(...checkmarks(diagonal[1], diagonal[2], new Step(1, 1), new Step(-1, -1)));

      return wins.length ? wins : false; // If there is a win return wins
   }

   doBotMove() {
      if (players[this.toMove].player.type === "bot")
         players[this.toMove].player.play();
      else
         console.info("Player must've changed into a human");
   }

   getMoves() {
      let moves = [];
      for (let y = 0; y < this.board.height; y++)
         for (let x = 0; x < this.board.width; x++)
            if (this.board[y][x].value === ' ')
               moves.push(new Position(x, y));
      return moves;
   }

   // Adds padding to left and right
   getAscii() {
      let str = `+-${'-'.repeat(this.board.width)}-+\n`;
      for (let y = 0; y < this.board.length; y++) {
         str += '| ';
         for (let x = 0; x < this.board.width; x++)
            if (this.board[y][x].value === '') str += ' ';
            else if (this.board[y][x].value === ' ') str += '.';
            else str += this.board[y][x].value;
         str += ' |\n';
      }
      str += `+-${'-'.repeat(this.board.width)}-+`;
      return str;
   }

   logAscii() {
      let text = this.getAscii();
      let args = ["", []];
      for (let char of text) {
         let css = "";
         if (char === PLAYER_CHARS[0]) css = 'color:red';
         else if (char === PLAYER_CHARS[1]) css = 'color:blue';
         else if (char === PLAYER_CHARS[2]) css = 'color:green';
         else if (char === PLAYER_CHARS[3]) css = 'color:orange';
         else if (char === '.') css = 'color:white';
         else if (char === ' ') css = 'background-color:gray';
         else if (char === '-') css = 'background-color:gray;color:gray';
         else css = 'color:white';

         args[0] += '%c' + char;
         args[1].push(css);
      }
      console.log(args[0], ...args[1]);
   }


}

function handleClick(x, y) {
   console.log("Click!", x, y);
   x -= currentGame.visual.offset.x;
   y -= currentGame.visual.offset.y;

   let square = currentGame.board?.[y]?.[x];
   if (square === undefined)
      throw ERRORS.EVIL_CLICK;

   if (players[currentGame.toMove].type === "human" && square.value === ' ')
      currentGame.play(x, y);
}

function notice(...args) {
   // TODO: do something
}

const player_assets = [
   "player_assets/x.png",
   "player_assets/o.png",
   "player_assets/triangle.png",
   "player_assets/square.png"
];

const PLAYER_CHARS = "xovn";

const PLAYER_BORDERS = [
   "red",
   "dodgerblue",
   "green",
   "#ffd74a"
];

const PLAYER_NAMES = [
   "x",
   "o",
   "triangle",
   "square",
   "pentagon"
];

const ELEMENTS = {
   container: document.getElementById('container'),
   infoElement: document.querySelector('#container aside'),
   gameDataElement: document.getElementById('gameData'),
   numPeopleSelect: document.querySelector('#personCountLabel select'),
   numPlayersSelect: document.querySelector('#playerAmountLabel select'),
   resetGameButton: document.getElementById('resetGame'),
   shifts: document.querySelectorAll('#mapControls button'),
   statsParagraph: document.getElementById('nonPlayerStats'),
   squares: [],

   getSquare(x, y) {
      return document.getElementById(`${x}-${y}`);
   },

   // {b} is unneccesary in {a b c}, the space selects all children
   // TODO: Only have a getter for non-constant elements
   getUsernameInputs() {
      return document.querySelectorAll('#nameFields fieldset input');
   },
   getEnablePersonButtons() {
      return document.querySelectorAll('#nameFields fieldset button.enable');
   },
   getDisablePersonButtons() {
      return document.querySelectorAll('#nameFields fieldset button.disable');
   },

   getPlayerSelects() {
      return document.querySelectorAll('#choosePlayerFields label select');
   },
   getEnabledPlayerSelects() {
      return document.querySelectorAll('#choosePlayerFields label select:enabled');
   },
   getEnablePlayerButtons() {
      return document.querySelectorAll('#choosePlayerFields button.enable');
   },
   getDisablePlayerButtons() {
      return document.querySelectorAll('#choosePlayerFields button.disable');
   }
};

// up down left right
ELEMENTS.shifts[0].onclick = () => {
   currentGame.visual.offset.y--;
   currentGame.updateVisual();
};
ELEMENTS.shifts[1].onclick = () => {
   currentGame.visual.offset.y++;
   currentGame.updateVisual();
};
ELEMENTS.shifts[2].onclick = () => {
   currentGame.visual.offset.x--;
   currentGame.updateVisual();
};
ELEMENTS.shifts[3].onclick = () => {
   currentGame.visual.offset.x++;
   currentGame.updateVisual();
};

for (let x = 0; x < 20; x++) {
   ELEMENTS.squares[x] = [];
   for (let y = 0; y < 20; y++) {
      let element = document.createElement('button');
      ELEMENTS.squares[x].push(element);

      element.id = `${x}-${y}`;
      element.setAttribute("aria-label", `Square at ${x}-${y}`);
      element.style.gridColumn = x + 1;
      element.style.gridRow = y + 1;
      element.onclick = handleClick.bind(element, x, y);
      ELEMENTS.container.appendChild(element);
   }
}

let gameHistory = [];
let currentGame = new Game();

ELEMENTS.resetGameButton.onclick = function resetGame () {
   gameHistory.push(currentGame);
   currentGame = new Game();
   currentGame.updateVisual();
   currentGame.updateVisualStats();
}

// Assumes that the enable and disable buttons are disabled / enabled when appropriate.
// For example, the enable button should not be enabled if the element is already enabled.
// So the errors might be wrong.

// Note: <var> <input>
ELEMENTS.numPeopleSelect.onchange = function (event) {
   console.log(EnableOrDisablePlayers.call(event.target));
};
ELEMENTS.numPlayersSelect.onchange = function (event) {
   console.log(EnableOrDisablePeople.call(event.target));
};
for (let input of ELEMENTS.getUsernameInputs())
   input.onchange = function usernameChange(event) {
      if (event.target.disabled) throw new ElementIsDisabledError(event.target);
      console.log(changeName.call(event.target));
   };
for (let button of ELEMENTS.getEnablePersonButtons())
   button.onclick = function (event) {
      if (event.target.disabled) throw new ElementIsAlreadyEnabledError(event.target);
      console.log(enablePerson.call(event.target.parentElement.children[0].children[1]));
   };
for (let button of ELEMENTS.getDisablePersonButtons())
   button.onclick = function (event) {
      if (event.target.disabled) throw new ElementIsAlreadyDisabledError(event.target);
      console.log(disablePerson.call(event.target.parentElement.children[0].children[1]));
   };
for (let select of ELEMENTS.getPlayerSelects())
   select.onchange = function playerChange(event) {
      if (event.target.disabled) throw new ElementIsDisabledError(event.target);
      console.log(changePlayer.call(event.target.selectedOptions[0]));
   };
for (let button of ELEMENTS.getEnablePlayerButtons())
   button.onclick = function (event) {
      if (event.target.disabled) throw new ElementIsAlreadyEnabledError(event.target);
      console.log(enablePlayer.call(event.target.parentElement.children[0].children[1]));
   };
for (let button of ELEMENTS.getDisablePlayerButtons())
   button.onclick = function (event) {
      if (event.target.disabled) throw new ElementIsAlreadyDisabledError(event.target);
      console.log(disablePlayer.call(event.target.parentElement.children[0].children[1]));
   };


class Player {
   constructor (type, name, disabled) {
      this.type = type;
      this.name = name;
      this.disabled = disabled;
      this.lastMove = null;
   }
}

class Human extends Player {
   constructor (name, disabled = true) {
      super("human", name, disabled);
   }
}

class Bot extends Player {
   constructor (name, mechanics, disabled = false) {
      super("bot", name, disabled);
      this.mechanics = mechanics;
   }

   play(...params) {
      if (this.disabled) throw new BotIsDisabledError(this);
      return this.mechanics.apply(currentGame, ...params);
   }
}

class PlayerReference {
   constructor (type, index) {
      if (type === "human" && people.length <= index)
         throw new ReferenceError(`Person at index ${index} doesn't exist`);
      else if (type === "bot" && bots.length <= index)
         throw new ReferenceError(`Bot at index ${index} doesn't exist`);

      this.type = type;
      this.index = index;
   }

   get player() {
      if (this.type === "human")
         return people[this.index];
      else
         return bots[this.index];
   }

   set disabled(isDisabled) {
      this.player.disabled = isDisabled;
   }

   get disabled() {
      return this.player.disabled;
   }
}

const bot_mechanics = {
   /** Chooses a random move */
   random_move() {
      const moves = this.getMoves();
      const chosen = moves[Math.floor(Math.random() * moves.length)];
      this.play(chosen.x, chosen.y);
   },
   /** Choosen the median move out of the list of moves */
   middle_index() {
      const moves = this.getMoves();
      let chosen;

      // a b c --> length: 3, index: 1
      // a b c d --> length: 4, index: 1 or 2
      if (moves.length % 2 === 1)
         chosen = moves[(moves.length - 1) / 2];
      else
         chosen = moves[
            Math.random() < 0.5
               ? moves.length / 2
               : (moves.length / 2) - 1
         ];
      this.play(chosen.x, chosen.y);
   },
   /** Copies the index of the move you just played */
   copy() {
      let moves = this.getMoves();
      let lastMove = this.moveHistory?.[this.moveHistory.length - 1];
      let positionOfLastMove = lastMove?.originalPosition;

      if (lastMove === undefined)
         bot_mechanics.random_move.apply(this);
      else {
         let indexOfLastMove = (
            this.gameStates[this.gameStates.length - 2]
               .originalMoves
               .findIndex(
                  position => position.x === positionOfLastMove.x
                     && position.y === positionOfLastMove.y
               )
         );

         if (indexOfLastMove === -1)
            throw ERRORS.IMPOSSIBLE_LAST_MOVE;
         const chosen = moves[indexOfLastMove];
         this.play(chosen.x, chosen.y);
      }
   },
   /** Tries to avoid the previous moves */
   avoider() {
      let moves = this.getMoves();
      for (let move of moves)
         move.distance = this.moveHistory.reduce((accum, curr) => (
            accum + curr.updatedDistance(move)
         ), 0)
      
      moves = moves.sort((move1, move2) => move2.distance - move1.distance)
                   .filter(move => moves[0].distance === move.distance);
      const chosen = moves[Math.floor(Math.random() * moves.length)];
      this.play(chosen.x, chosen.y);
   },
   /** Makes the previous moves uncomfortable */
   closer() {
      let moves = this.getMoves();
      for (let move of moves)
         move.distance = this.moveHistory.reduce((accum, curr) => (
            accum + curr.updatedDistance(move)
         ), 0);
      
      moves = moves.sort((move1, move2) => move1.distance - move2.distance)
                   .filter(move => moves[0].distance === move.distance);
      const chosen = moves[Math.floor(Math.random() * moves.length)];
      this.play(chosen.x, chosen.y);
   },
   /** Makes the first move on diagonal 1 */
   firstDiagonal() {
      let moves = this.getMoves().filter(move => (
         (this.board.width + this.board.height + move.x + move.y) % 2 === 0
      ));
      if (moves.length === 0)
         bot_mechanics.random_move.apply(this);
      else {
         const chosen = moves[Math.floor(Math.random() * moves.length)];
         this.play(chosen.x, chosen.y);
      }
   },
};


let activeBots = 1;
let activePeople = 1;
let activePlayers = 2;

let people = [
   new Human("Person 1"),
   new Human("Person 2"),
   new Human("Person 3"),
   new Human("Person 4")
];

let bots = [];
for (let key of Object.keys(bot_mechanics)) {
   let newBot = new Bot(key, bot_mechanics[key]);
   bots.push(newBot);
   bots[key] = newBot;
}

let players = [
   new PlayerReference("human", 0),
   new PlayerReference("bot", 0)
];


// These async functions are really fast
// They might not even need to be async functions,
// But it's nice and I might need them for tournaments.

/* async function          this                          event element (if different)
 * EnableOrDisablePlayers  #playerAmountLabel <select>
 * EnableOrDisablePeople   #personCountLabel <select>
 * changePlayer            #choosePlayerFields <option>  #choosePlayerFields <select>
 * changeName              #nameFields <input>
 * enablePerson            #nameFields <input>           #nameFields <button.enable>
 * disablePerson           #nameFields <input>           #nameFields <button.disable>
 * enablePeople            undefined                     used in EnableOrDisablePeople
 * disablePeople           undefined                     used in EnableOrDisablePeople
 * enablePlayer            #choosePlayerFields <option>? #choosePlayerFields <button.enable>
 * disablePlayer           #choosePlayerFields <option>? #choosePlayerFields <button.disable>
 * enablePlayers           undefined                     used in EnableOrDisablePlayers
 * disablePlayers          undefined                     used in EnableOrDisablePlayers
 * 
 * <this> = <select> or <input> in general
 * 
 * ....[10] = "Username #A"
 * ....[8]  = "Player #8"
 */

// this = #playerAmountLabel <select>
async function EnableOrDisablePlayers() {
   if (this.value < activePlayers)
      return await disablePlayers(Number(this.value));
   else if (this.value > activePlayers)
      return await enablePlayers(Number(this.value));
   else
      throw new DidntChangeError();
}

// this = #personCountLabel <select>
async function EnableOrDisablePeople() {
   if (this.value < activePeople)
      return await disablePeople(Number(this.value));
   else if (this.value > activePeople)
      return await enablePeople(Number(this.value));
   else
      throw new DidntChangeError();
}

// this = <option>
async function changePlayer() {
   this.selected = true;

   let type = this.parentElement.label === "Bots" ? "bot" : "human"; // <optgroup> label

   let playerIndex = this.parentElement.parentElement.parentElement.innerText[8] - 1;
   if (players[playerIndex].type !== type)
      if (type === "bot") {
         activePeople--;
         activeBots++;
      } else {
         activePeople++;
         activeBots--;
      }

   let localIndex = Array.prototype.indexOf.call(
      this.parentElement.children, this
   );

   players[playerIndex] = new PlayerReference(type, localIndex);
   currentGame.playBots();
   return ["Done! Player changed: ", players[playerIndex]];
}

// this = <input>
async function changeName() {
   let correctIndex = this.parentElement.innerText[10] - 1;
   let name = this.value.length ? this.value : this.placeholder;
   people[correctIndex].name = name;

   for (let select of ELEMENTS.getPlayerSelects())
      select.firstElementChild.children[correctIndex].text = name;
   return `Done: Name changed to ${name}`;
}

// this = <input>
async function enablePerson() {
   // MAX_PLAYERS_REACHED and EVERYONEs_ENABLED both fit...
   if (activePeople === 4) throw ERRORS.EVERYONEs_ENABLED;
   activePeople++; ELEMENTS.numPeopleSelect.selectedIndex++;

   const personIndex = this.parentElement.innerText[10] - 1;
   people[personIndex].disabled = false;

   for (let select of ELEMENTS.getPlayerSelects())
      select.firstElementChild.children[personIndex].disabled = false;

   this.disabled = false;
   this.parentElement.parentElement.children[1].disabled = true;
   this.parentElement.parentElement.children[2].disabled = false;
   return `Done: Person at index ${personIndex} enabled.`;
}


// Bug, probably feature: Player not changed when disabled
async function disablePerson() {
   if (activePeople === 0) throw ERRORS.NO_ONEs_ENABLED;
   activePeople--; ELEMENTS.numPeopleSelect.selectedIndex--;

   const personIndex = this.parentElement.innerText[10] - 1;
   people[personIndex].disabled = true;

   for (let select of ELEMENTS.getPlayerSelects())
      select.firstElementChild.children[personIndex].disabled = true;

   this.disabled = true;
   this.parentElement.parentElement.children[1].disabled = false;
   this.parentElement.parentElement.children[2].disabled = true;
   return `Done: Person at index ${personIndex} disabled.`;
}

// num === Number(this.value), in enableOrDisablePlayers
// Will only warn about bad num in the inner button.click()s
async function enablePeople(num) {
   let clickPromises = [];
   let counter = activePeople;
   for (let button of ELEMENTS.getEnablePersonButtons()) {
      if (button.disabled) continue;
      clickPromises.push(button.click());
      
      if (++counter === num) break;
   }

   let promiseGroup = Promise.allSettled(clickPromises);
   for (let promise of promiseGroup)
      if (promise.status === 'rejected') throw promiseGroup;

   if (counter !== num)
      console.warn(`Failed to enable the correct amount: ${counter} !== ${num}`);

   return promiseGroup;
}

// Disables first-to-last just like enable.
async function disablePeople(num) {
   let clickPromises = [];
   let counter = activePeople;
   for (let button of ELEMENTS.getDisablePersonButtons()) {
      if (button.disabled) continue;
      clickPromises.push(button.click());
      if (--counter === num) break;
   }

   let promiseGroup = Promise.allSettled(clickPromises);
   for (let promise of promiseGroup)
      if (promise.status === 'rejected') throw promiseGroup;

   activePeople = counter;
   if (counter !== num)
      console.warn(`Failed to disable the correct amount: ${counter} !== ${num}`);

   return promiseGroup;
}

// this = <select disabled>
async function enablePlayer() {
   if (activePlayers === 4) throw ERRORS.MAX_PLAYERS_REACHED;
   activePlayers++; ELEMENTS.numPeopleSelect.selectedIndex++;
   activeBots++;

   this.disabled = false;
   this.parentElement.nextElementSibling.disabled = true;
   this.parentElement.nextElementSibling.nextElementSibling.disabled = false;

   this.selectedIndex = 4;
   
   // Add a dummy player before dispatchEvent
   players.push(new PlayerReference("bot", 0));
   this.dispatchEvent(new Event("change")); // triggers changePlayer; *changes* new player
   
   // if (currentGame.toMove === 0) currentGame.toMove = players.length - 1
   // doesn't make sense here because player added is a bot

   return "Done! Enabled player (random_move for safety)";
}

// Min players: 1
async function disablePlayer() {
   // if (activePlayers === 0) throw ERRORS.NO_ONEs_ENABLED;
   // activePlayers--;
   
   console.warn(NOT_DONE_YET);
   // this.disabled = true;
}

// Number!
async function enablePlayers(num) {
   let clickPromises = [];
   let counter = activePlayers;
   for (let button of ELEMENTS.getEnablePlayerButtons()) {
      if (button.disabled) continue;
      clickPromises.push(button.click());
      if (++counter === num) break;
   }

   let promiseGroup = await Promise.allSettled(clickPromises);
   for (let promise of promiseGroup)
      if (promise.status === 'rejected') throw promiseGroup;

   // eslint-disable-next-line require-atomic-updates
   // Doesn't apply in this case
   activePlayers = counter;
   if (counter !== num)
      console.warn(`Failed to enable the correct amount: ${counter} !== ${num}`);
   
   return promiseGroup;
}

async function disablePlayers(num) {
   let clickPromises = [];
   let counter = activePlayers;
   for (let button of ELEMENTS.getDisablePlayerButtons()) {
      if (button.disabled) continue;
      clickPromises.push(button.click());
      if (--counter === num) break;
   }

   let promiseGroup = await Promise.allSettled(clickPromises);
   for (let promise of promiseGroup)
      if (promise.status === 'rejected') throw promiseGroup;

   activePlayers = counter;
   if (counter !== num)
      console.warn(`Failed to disable the correct amount: ${counter} !== ${num}`);
   
   return promiseGroup;
}


/*
Types: human, bot
Throws an errror when doing bot move but player is changed to human


*/

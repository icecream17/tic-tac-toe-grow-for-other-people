// This is licensed under the Apache License 2.0,
// see https://github.com/icecream17/tic-tac-toe-grow-for-website/blob/main/LICENSE

// Note: The CustomError class is not licensed under the Apache License 2.0
// Note: The comments are in the public domain.

import { Player } from './player.js'

// The log levels used are:
// verbose, by console.debug
// info, by console.info or console.log
// error, either by throwing an error, but also maybe console.error

import { valuesEqual } from './utils.js'

export class Position {
   constructor (x, y) {
      this.x = x
      this.y = y
   }

   /** Returns the manhattan distance from another position */
   distance (position) {
      return Math.abs(this.x - position.x) + Math.abs(this.y - position.y)
   }

   /** Method returning a shallow copy of the position */
   copy () {
      return new Position(this.x, this.y)
   }
}

export class Step {
   constructor (vx, vy) {
      this.vx = vx
      this.vy = vy
   }
}

export class Cell extends Position {
   constructor (move, x, y) {
      super(x, y)
      this.win = false // If part of a win
      this.move = null // Move (if any) played on that square
   }
}

export class Move extends Position {
   // "Move" is highly bound to the class "Game".
   // super(newXY.x, newXY.y);
   // this.index = game.moveHistory.length
   constructor (oldXY, newXY, player, game = currentGame) {
      super(newXY.x, newXY.y)
      this.game = game
      this.index = game.moveHistory.length // must be true
      this.player = player
      this.positionAtLastUpdate = new Position(this.x, this.y)
      this.lastUpdateIndex = this.index

      this.originalPosition = oldXY // No board update
   }

   // Get the gameState on demand instead of using unneccesary storage
   get gameState () {
      return this.game.getGameStateAt(this.index)
   }

   /**
    * The board might've updated, and gotten a new row to the left for example.
    * So this getter method gets the updated position of a move.
    */
   get correspondingPosition () {
      for (; this.lastUpdateIndex < this.game.moveHistory.length; this.lastUpdateIndex++) {
         const nextMove = this.game.moveHistory[this.lastUpdateIndex].originalPosition
         if (nextMove.x === 0) { this.positionAtLastUpdate.x++ }
         if (nextMove.y === 0) { this.positionAtLastUpdate.y++ }
      }
      return this.positionAtLastUpdate.copy()
   }

   updatedDistance (position) {
      const updatedPosition = this.correspondingPosition
      return Math.abs(updatedPosition.x - position.x) +
           Math.abs(updatedPosition.y - position.y)
   }
}

class GameBase {
   #MAX_LENGTH = 511
   #MAX_TURNS = 314
   static INITIAL_MAX_LENGTH = 511
   static INITIAL_MAX_TURNS = 314
   static MIN_PLAYERS = 2

   constructor (participants) {
      this.turn = 0 /** Starts at 0 */
      this.ply = 0
      this.toMove = 0 // index in player array
      this.result = null
      this.participants = participants
      this.winners = []

      this.board = [
         [new Cell(' ', 0, 0), new Cell(' ', 0, 1), new Cell(' ', 0, 2)],
         [new Cell(' ', 1, 0), new Cell(' ', 1, 1), new Cell(' ', 1, 2)],
         [new Cell(' ', 2, 0), new Cell(' ', 2, 1), new Cell(' ', 2, 2)]
      ] // WARNING: this.board[y][x]
      this.board.width = 3
      this.board.height = 3 // same as this.board.length

      this.moveHistory = []
   }

   // NOTE: No value validation.
   set MAX_LENGTH (value) { this.#MAX_LENGTH = value }
   get MAX_LENGTH () { return this.#MAX_LENGTH }
   set MAX_TURNS (value) { this.#MAX_TURNS = value }
   get MAX_TURNS () { return this.#MAX_TURNS }

   get playerToMove () {
      return this.participants[this.toMove]
   }

   setCell (x, y, value) {
      this.board[y][x] = new Cell(value, x, y)
   }

   // No update function provided!

   updateBoard (x, y) {
      // Possible bug in the future, the else ifs assume that the
      // first cell is not the same as the last cell, which would be untrue if
      // the board was somehow one cell big.
      
      // Idea: could support starting from an arbitrary board.

      // Since we grow the board down at the 4 ifs,
      // the (i === x ? ' ' : '') is redundant
      if (y === 0) {
         this.board.unshift([])
         for (let i = 0; i < this.board.width; i++) {
            this.board[0].push(
               new Cell(i === x ? ' ' : '', i, 0)
            )
         }
         this.board.height++; y++
      } else if (y === this.board.height - 1) {
         this.board.push([])
         this.board.height++
         for (let i = 0; i < this.board.width; i++) {
            this.board[this.board.height - 1].push(
               new Cell(i === x ? ' ' : '', i, this.board.height - 1)
            )
         }
      }

      if (x === 0) {
         for (let i = 0; i < this.board.length; i++) {
            this.board[i].unshift(
               new Cell(i === y ? ' ' : '', i, 0)
            )
         }
         this.board.width++; x++
      } else if (x === this.board.width - 1) {
         for (let i = 0; i < this.board.length; i++) {
            this.board[i].push(
               new Cell(i === y ? ' ' : '', i, this.board.width)
            )
         }
         this.board.width++
      }

      if (this.board[y - 1][x].value === '') { this.setCell(x, y - 1, ' ') }
      if (this.board[y + 1][x].value === '') { this.setCell(x, y + 1, ' ') }
      if (this.board[y][x - 1].value === '') { this.setCell(x - 1, y, ' ') }
      if (this.board[y][x + 1].value === '') { this.setCell(x + 1, y, ' ') }

      this.board[y][x] = new Cell(PLAYER_CHARS[this.toMove], x, y)
      this.board[y][x].moveIndex = this.moveHistory.length

      for (let y2 = 0; y2 < this.board.length; y2++) {
         for (let x2 = 0; x2 < this.board.width; x2++) {
            this.board[y2][x2].y = y2
            this.board[y2][x2].x = x2
         }
      }

      return this.board[y][x]
   }

   updateGameEnd (result, lastX, lastY) {
      // Even if a win happens after a draw, or a draw happens after a win,
      // or even a win happens after a win, *only the first result counts*.
      this.result ??= result[0]

      // Converted from an "if, else if, else" statement.
      switch (result[0]) {
      case 'win':
         {
            notice('WINNNN', result)
            for (const cell of result[1].flat().concat(this.board[lastY][lastX])) {
               cell.win = true
            }

            const winArray = [this.toMove, PLAYER_NAMES[this.toMove], this.playerToMove.player]
            if (this.winners.every(array => !valuesEqual(array, winArray))) {
               this.winners.push(winArray)
            }
         }
         break
      case 'draw':
         notice(`*gasp*! Draw!\n${result[1]}`, result)
         break
      default:
         ERRORS.INVALID_MOVE_FINISH.rethrow()
      }
   }

   checkGameEnd (x, y) {
      const win = this.checkWin(x, y)
      if (win) { return ['win', win] }

      // In this case, a switch statement would be worse.
      if (this.board.width > 7 * this.board.height) {
         return ['draw', 'width is 7 times the height']
      } else if (this.board.height > 7 * this.board.width) {
         return ['draw', 'height is 7 times the width']
      } else if (this.turn >= this.MAX_TURNS) {
         return ['draw', `max turns reached (${Game.MAX_TURNS})`]
      } else if (this.board.width >= this.MAX_LENGTH) {
         return ['draw', `max length reached by width (${Game.MAX_LENGTH})`]
      } else if (this.board.height >= this.MAX_LENGTH) {
         return ['draw', `max length reached by height (${Game.MAX_LENGTH})`]
      } else {
         return false
      }
   }

   checkWin (x, y) {
      const playerValue = this.board[y][x].value
      const wins = []
      const orthogonal = [[], [], [], []]
      const diagonal = [[], [], [], []]

      // Arrow function so that "this" is not undefined
      const goDiagonal = (x2, y2, step) => {
         const diag = [this.board[y2][x2]]
         const currentPos = new Position(x2, y2)

         // Intentional loop condition
         while (true) {
            currentPos.x += step.vx
            currentPos.y += step.vy
            const square = this.board[currentPos.y]?.[currentPos.x]

            if (square?.value !== playerValue) { break }
            diag.push(square)
         }

         return diag
      }

      for (let i = 0; i < 4; i++) {
         const orthogonalStep = [
            new Step(-1, 0),
            new Step(1, 0),
            new Step(0, 1),
            new Step(0, -1)
         ][i]

         const diagonalStep = [
            new Step(1, 1),
            new Step(1, -1),
            new Step(-1, 1),
            new Step(-1, -1)
         ][i]

         orthogonal[i] = goDiagonal(x, y, orthogonalStep)
         diagonal[i] = goDiagonal(x, y, diagonalStep)
      }

      // good good good n good good good
      // n 1 1 1 n 2 2 2
      function sevenNArow (oneDirection, oppositeDirection) {
         if (oneDirection.length + oppositeDirection.length >= 8) {
            return oneDirection.slice(1).concat(...oppositeDirection)
         } else {
            return false
         }
      }

      function checkMark (side1, side2) {
         if (isValidCheckmark(side1, side2)) {
            return side1.slice(1).concat(...side2)
         } else {
            return false
         }
      }

      function isValidCheckmark (side1, side2) {
         return (side1.length >= 2 && side2.length >= 4) ||
                (side1.length >= 4 && side2.length >= 2)
      }

      const sevenChecks = [
         sevenNArow(orthogonal[0], orthogonal[1]),
         sevenNArow(orthogonal[2], orthogonal[3]),
         sevenNArow(diagonal[0], diagonal[3]),
         sevenNArow(diagonal[1], diagonal[2])
      ]

      for (const sevenNArowCheck of sevenChecks) {
         if (sevenNArowCheck) {
            wins.push(sevenNArowCheck)
         }
      }

      const rightAngleMarkChecks = [
         checkMark(diagonal[0], diagonal[1]),
         checkMark(diagonal[0], diagonal[2]),
         checkMark(diagonal[3], diagonal[1]),
         checkMark(diagonal[3], diagonal[2])
      ]

      for (const markCheck of rightAngleMarkChecks) {
         if (markCheck) {
            wins.push(markCheck)
         }
      }

      // arrow function in order to access "this"
      // arguments = diagonal, oppositeDiagonal, perpendicularStep, oppositePerpendicularStep
      const checkmarks = (diag, oppDiag, perpStep, oppPerpStep) => {
         // The way the diags work:
         // above, the squares are pushed onto the array, *away* from the xy.
         // So the diag arrays' first elements are the ones in the diag closer to the xy
         const newWins = []

         // The checkmarks are made of the opposite diagonal,
         // plus this diagonal (minus the shared cell), which make one big side,
         // then the other perpendicular sides.
         let currBase = [...oppDiag.slice(1), diag[0]] // Reordering cells
         for (const square of diag.slice(1)) {
            currBase.push(square)
            const perpDiag = goDiagonal(square.x, square.y, perpStep)
            const oppPerpDiag = goDiagonal(square.x, square.y, oppPerpStep)
            if (isValidCheckmark(currBase, perpDiag)) { newWins.push([...currBase, ...perpDiag.slice(1)]) }
            if (isValidCheckmark(currBase, oppPerpDiag)) { newWins.push([...currBase, ...oppPerpDiag.slice(1)]) }
         }

         currBase = [...diag.slice(1), diag[0]]
         for (const square of oppDiag.slice(1)) {
            currBase.push(square)
            const perpDiag = goDiagonal(square.x, square.y, perpStep)
            const oppPerpDiag = goDiagonal(square.x, square.y, oppPerpStep)
            if (isValidCheckmark(currBase, perpDiag)) { newWins.push([...currBase, ...perpDiag.slice(1)]) }
            if (isValidCheckmark(currBase, oppPerpDiag)) { newWins.push([...currBase, ...oppPerpDiag.slice(1)]) }
         }

         return newWins
      }

      wins.push(...checkmarks(diagonal[0], diagonal[3], new Step(1, -1), new Step(-1, 1)))
      wins.push(...checkmarks(diagonal[1], diagonal[2], new Step(1, 1), new Step(-1, -1)))

      return wins.length ? wins : false // If there is a win return wins
   }

   getMoves () {
      const moves = []
      for (let y = 0; y < this.board.height; y++) {
         for (let x = 0; x < this.board.width; x++) {
            if (this.board[y][x].value === ' ') { moves.push(new Position(x, y)) }
         }
      }
      return moves
   }

   // Adds padding to left and right
   getAscii () {
      let ascii = `+-${'-'.repeat(this.board.width)}-+\n`
      for (let y = 0; y < this.board.length; y++) {
         ascii += '| '
         for (let x = 0; x < this.board.width; x++) {
            if (this.board[y][x].value === '') { ascii += ' ' } else if (this.board[y][x].value === ' ') { ascii += '.' } else { ascii += this.board[y][x].value }
         }
         ascii += ' |\n'
      }
      return (ascii += `+-${'-'.repeat(this.board.width)}-+`)
   }

   logAscii (verbose) {
      let ascii = `%c+%c-${'-'.repeat(this.board.width)}-%c+\n`
      const css = [
         'color:white',
         'background-color:gray;color:gray',
         'color:white'
      ]

      for (let y = 0; y < this.board.length; y++) {
         ascii += '%c|%c '
         css.push('color:white', 'background-color:gray')

         for (let x = 0; x < this.board.width; x++) {
            const char = this.board[y][x].value
            ascii += '%c'
            if (char === '') {
               ascii += ' '
               css.push('background-color:gray')
            } else if (char === ' ') {
               ascii += '.'
               css.push('color:white')
            } else if (PLAYER_CHARS.includes(char)) {
               ascii += char
               css.push(
                  `color:${
                     ['red', 'blue', 'green', 'orange', 'purple'][PLAYER_CHARS.indexOf(char)]
                  }${this.board[y][x].win ? ';background-color:#CFC' : ''}`
               )
            }
         }

         ascii += '%c %c|\n'
         css.push('background-color:gray', 'color:white')
      }
      ascii += `%c+%c-${'-'.repeat(this.board.width)}-%c+\n`
      css.push(
         'color:white',
         'background-color:gray;color:gray',
         'color:white'
      )

      if (verbose) { console.debug(ascii, ...css) } else { console.log(ascii, ...css) }
   }
}

class GameState extends GameBase {
   constructor (game) {
      super()
      this.game = game
   }

   doMove (move) {
      let { x, y } = move.originalPosition
      if (this.board[y][x].value !== ' ') { ERRORS.SQUARE_NOT_UPDATED.rethrow() }

      // () To prevent parsing as a block
      ({ x, y } = Game.prototype.updateBoard.call(this, x, y))

      const moveFinish = Game.prototype.checkGameEnd.call(this, x, y)
      if (moveFinish !== false) { Game.prototype.updateGameEnd.call(this, moveFinish, x, y) }

      this.moveHistory.push(move)
      this.ply++
      this.toMove = (this.toMove + 1) % this.participants.length
      if (this.toMove === 0) { this.turn++ }
   }

   get originalMoves () {
      const moves = []
      for (let y = 0; y < this.board.height; y++) {
         for (let x = 0; x < this.board.width; x++) {
            if (this.board[y][x].value === ' ') { moves.push(new Position(x, y)) }
         }
      }
      return moves
   }

   get correspondingMoves () {
      const moves = this.originalMoves
      for (const move of moves) {
         for (
            let index = this.moveHistory.length;
            index < this.game.moveHistory.length;
            index++
         ) {
            const nextMove = this.game.moveHistory[index].originalPosition
            if (nextMove.x === 0) { move.x++ }
            if (nextMove.y === 0) { move.y++ }
         }
      }
      return moves
   }
}

export class Game extends GameBase {
   constructor (participants, visual = true, onMove = ()=>null) {
      if (visual) {
         participants = players
      }
      super(participants)

      if (visual) {
         this.visual = []
         this.visual.offset = new Position(0, 0)
         this.visualStart()
      } else {
         this.isSimulation = true
      }
      
      // Callback for custom purposes. Default function does nothing
      // Called with params (this, oldPosition, newPosition)
      // newPosition is the position after the board updates
      this.onMove = onMove
   }

   play (x, y) {
      console.debug(`(update) move: ${x} ${y}`)

      if (this.board[y][x].value !== ' ') { throw ERRORS.SQUARE_NOT_UPDATED.rethrow() }

      const oldPosition = { x, y };
      ({ x, y } = this.updateBoard(x, y))

      const moveFinish = this.checkGameEnd(x, y)
      if (moveFinish !== false) { this.updateGameEnd(moveFinish, x, y) }

      this.moveHistory.push(new Move(oldPosition, { x, y }, this.playerToMove, this))

      // updateVisual must go after setting lastMove but before setting toMove
      if (this === currentGame) { this.updateVisual() }

      this.ply++
      this.toMove = (this.toMove + 1) % this.participants.length
      if (this.toMove === 0) { this.turn++ }

      // But this must go after setting turn
      if (this === currentGame) { this.updateVisualStats() }
      this.onMove(this, oldPosition, {x, y})

      console.debug(`(update) move: ${x} ${y}, moveFinish: ${moveFinish}`)
   }

   // Gets the game state *before* a move is played
   // So if moveIndex was 0, it would get the starting position
   getGameStateAt (moveIndex) {
      const gameCopy = new GameState(this)
      for (let i = 0; i < moveIndex; i++) {
         gameCopy.doMove(this.moveHistory[i])
      }

      return gameCopy
   }
}

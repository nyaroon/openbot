import { defineMessages } from "../../../message";

export const messages = defineMessages("error.boards", {
  "error.boards.serverTooOld": "This server does not support boards. Update OpenBot on the computer that runs it.",
  "error.boards.tooLargeToSend": "This board is too large to send to this client.",
  "error.boards.invalidChange": "This board change is not valid.",
  "error.boards.boardMissing": "This board no longer exists.",
  "error.boards.columnMissing": "This column no longer exists.",
  "error.boards.cardMissing": "This card no longer exists.",
  "error.boards.tooManyBoards": "The server has the maximum number of boards. Delete a board first.",
  "error.boards.tooManyColumns": "This board has the maximum number of columns. Delete a column first.",
  "error.boards.tooManyCards": "This board has the maximum number of cards. Archive or delete a card first.",
  "error.boards.lastColumn": "A board needs at least one column.",
  "error.boards.columnNotEmpty": "This column still has cards. Choose another column to move them to.",
  "error.boards.columnTarget": "Choose a different column on the same board.",
  "error.boards.cardPlacement": "The card cannot be placed there. Refresh the board and try again.",
});

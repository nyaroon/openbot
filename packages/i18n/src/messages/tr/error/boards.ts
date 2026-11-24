import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/boards";

export const messages = {
  "error.boards.serverTooOld":
    "Bu sunucu panoları desteklemiyor. OpenBot'u sunucuyu çalıştıran bilgisayarda güncelleyin.",
  "error.boards.tooLargeToSend": "Bu pano bu istemciye gönderilemeyecek kadar büyük.",
  "error.boards.invalidChange": "Bu değişiklik geçerli değil.",
  "error.boards.boardMissing": "Bu pano artık yok.",
  "error.boards.columnMissing": "Bu sütun artık yok.",
  "error.boards.cardMissing": "Bu kart artık yok.",
  "error.boards.tooManyBoards": "Sunucudaki pano sayısı üst sınıra ulaştı. Önce bir pano silin.",
  "error.boards.tooManyColumns": "Bu panodaki sütun sayısı üst sınıra ulaştı. Önce bir sütun silin.",
  "error.boards.tooManyCards": "Bu panodaki kart sayısı üst sınıra ulaştı. Önce bir kartı arşivleyin veya silin.",
  "error.boards.lastColumn": "Bir panoda en az bir sütun olmalı.",
  "error.boards.columnNotEmpty": "Bu sütunda hâlâ kartlar var. Kartları taşımak için başka bir sütun seçin.",
  "error.boards.columnTarget": "Aynı panodan farklı bir sütun seçin.",
  "error.boards.cardPlacement": "Kart oraya yerleştirilemiyor. Panoyu yenileyip tekrar deneyin.",
} as const satisfies PartialTranslation<typeof source>;

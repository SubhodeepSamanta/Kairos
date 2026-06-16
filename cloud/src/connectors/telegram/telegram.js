import TelegramBot from "node-telegram-bot-api";

export function startTelegramBot(
    token,
    onMessage
) {
    const bot =
        new TelegramBot(
            token,
            {
                polling: true
            }
        );

    bot.on("polling_error", (error) => {
        // Quietly handle connection errors due to blocked Telegram bot API access
    });

    bot.on(
        "message",
        async (msg) => {
            const text =
                msg.text?.trim();

            if (!text) {
                return;
            }

            try {
                const response =
                    await onMessage(
                        text
                    );

                await bot.sendMessage(
                    msg.chat.id,
                    response
                );
            }

            catch (error) {

  console.error(
    "TELEGRAM ERROR:",
    error
  );

  try {
    await bot.sendMessage(
      msg.chat.id,
      `Error: ${error.message}`
    );
  } catch {}

}
        }
    );

    return bot;
}
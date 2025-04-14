# Slack AI

<img src="https://github.com/user-attachments/assets/2a263a30-03a9-460d-a09a-bb0418424f56" width="300">


Slack AI (from Salesforce) in theory sounds interesting, but it's very expensive ($10/active seat/month!) and you may have privacy concerns about sensitive data being shared with Slack AI's providers. In contrast, this bot is vastly cheaper and provides more control over AI models, providers used, and the system prompt.

## How to use

1. Install the bot onto your Slack workspace (see below)
2. Right click a message in a thread
3. Go to "More message shortcuts..."
4. Click on "Summarize thread"
5. Wait for your summary

## Running the bot yourself

Install dependencies:

```bash
bun install
```

Then, create a `.env` file with these values:

```env
SLACK_APP_TOKEN=xapp-...
SLACK_BOT_TOKEN=xoxb-...

OPENAI_API_KEY="..."
OPENAI_API_URL="..."
OPENAI_MODEL="..."
```

If you don't expect to use Slack AI more than 50 times a day (across all users), and **you don't mind your data being used for training,** you can use [DeepSeek v3 for free](https://openrouter.ai/deepseek/deepseek-chat-v3-0324:free) via OpenRouter.

You may also want to change the prompt used - you can do so by editing `prompt.txt`.

Finally, run the bot:

```bash
bun start
```

---

#### License

<sup>
Licensed under either of <a href="LICENSE-APACHE">Apache License, Version
2.0</a> or <a href="LICENSE-MIT">MIT License</a>, at your option.
</sup>

<br>

<sub>
Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this application by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
</sub>

import { App, LogLevel } from "@slack/bolt";
import { type } from "arktype";

import type Slack from "@slack/bolt";
import OpenAI from "openai";

const envSchema = type({
  SLACK_BOT_TOKEN: "string",
  SLACK_APP_TOKEN: "string",
  OPENAI_API_KEY: "string",
  OPENAI_API_URL: "string.url",
  OPENAI_MODEL: "string",
});
const env = envSchema(process.env);

if (env instanceof type.errors) {
  console.error("Environment variables validation failed:");
  console.error(env.summary);
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: env.OPENAI_API_URL,
});

const app = new App({
  token: env.SLACK_BOT_TOKEN,
  appToken: env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: LogLevel.INFO,
});

app.shortcut(
  { callback_id: "summarize_thread", type: "message_action" },
  async ({ ack, client, payload, body, context }) => {
    await ack();

    const threadTs = payload.message.thread_ts || payload.message.ts;
    const channelId = payload.channel.id;
    const viewId = await openInitialModal(body.trigger_id, client);
    const updateModalText = (text: string) => {
      updateModal(text, client, viewId);
    };

    // Step 1: Get all the thread messages
    let messages = undefined;
    try {
      await client.conversations.join({
        channel: channelId,
      });
      messages = await fetchEntireThread(client, channelId, threadTs);
    } catch (error) {
      const errorStr = (
        error as unknown as { toString: () => string }
      ).toString();

      if (errorStr.includes("not_in_channel")) {
        return await updateModalText(
          `:x: Please add <@${context.botUserId}> to the channel to summarize the thread.`
        );
      }

      if (
        errorStr.includes("channel_not_found") ||
        errorStr.includes("method_not_supported_for_channel_type")
      ) {
        return await updateModalText(
          `:x: This is a private channel. Please add <@${context.botUserId}> to the channel to summarize the thread.`
        );
      }

      console.error(`Error fetching thread: ${errorStr}`);
      return await updateModalText(`:x: Error fetching thread: ${errorStr}`);
    }
    const messagesText = messagesArrayToText(messages);

    // Step 2: Get the AI response
    let summaryText = `:white_check_mark: Here's your summary!:\n\n`;
    try {
      for await (const chunk of await getAiResponse(messagesText)) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          summaryText += delta.content;
          await updateModalText(summaryText);
        }
      }
    } catch (error) {
      console.error(`Error calling AI provider: ${error}`);
      await updateModalText(
        ":x: Error whilst calling AI provider (probably because of rate limiting). Please try again in 2-3 minutes, or DM <@U059VC0UDEU> for help."
      );
      return;
    }
  }
);

app.view("modal-callback", async ({ ack }) => {
  await ack();
});

async function openInitialModal(
  triggerId: string,
  client: Slack.webApi.WebClient
) {
  const result = await client.views.open({
    trigger_id: triggerId,
    view: {
      type: "modal",
      callback_id: "modal-callback",
      title: {
        type: "plain_text",
        text: "AI summary",
      },
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: ":safari-loading: Fetching summary... This may take a few seconds.",
          },
        },
      ],
    },
  });
  if (!result.ok) {
    throw new Error(`Error opening modal: ${result.error}`);
  }
  return result.view?.id as string;
}

async function updateModal(
  text: string,
  client: Slack.webApi.WebClient,
  viewId: string
) {
  const result = await client.views.update({
    view_id: viewId,
    view: {
      type: "modal",
      callback_id: "modal-callback",
      title: {
        type: "plain_text",
        text: "AI summary",
      },
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text,
          },
        },
      ],
      submit: {
        type: "plain_text",
        text: "Understood!",
      },
    },
  });
  if (!result.ok) {
    throw new Error(`Error updating modal: ${result.error}`);
  }
}

async function fetchEntireThread(
  client: Slack.webApi.WebClient,
  channelId: string,
  threadTs: string
) {
  let allMessages: Slack.webApi.ConversationsRepliesResponse["messages"] = [];
  let cursor = undefined;
  let hasMore = true;

  while (hasMore) {
    try {
      const result = await client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        limit: 1000, // Maximum allowed by Slack API
        cursor: cursor,
      });

      if (!result.ok) {
        throw new Error(`Failed to fetch thread: ${result.error}`);
      }

      allMessages = allMessages.concat(result.messages ?? []);

      hasMore = result.has_more || false;
      cursor = result.response_metadata?.next_cursor;

      // If no cursor but we have more, something went wrong
      if (hasMore && !cursor) {
        throw new Error("Missing pagination cursor while more messages exist");
      }
    } catch (error) {
      console.error(`Error fetching thread messages: ${error}`);
      throw error;
    }
  }

  return allMessages;
}

function reactionsAsText(reactions: { name?: string; count?: number }[]) {
  if (!reactions || reactions.length === 0) {
    return "";
  }
  return reactions
    .map((reaction) => `(:${reaction.name}: ${reaction.count})`)
    .join(" ");
}

function messagesArrayToText(
  messages: Slack.webApi.ConversationsRepliesResponse["messages"]
) {
  if (!messages || messages.length === 0) return "<no messages>"; // FIXME: this is a hack
  return messages
    .map(
      (message) =>
        `${message.thread_ts === message.ts ? "[parent message] " : ""}${
          message.user
        }${message.reactions ? reactionsAsText(message.reactions) : ""}${
          message.text
        }`
    )
    .join("\n");
}

const model = env.OPENAI_MODEL;
const prompt = await Bun.file("prompt.txt").text();
async function getAiResponse(messagesText: string) {
  return await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: prompt,
      },
      {
        role: "user",
        content: messagesText,
      },
    ],
    stream: true,
  });
}

await app.start();
console.log("⚡️ Slack bot is running in Socket Mode");

/* eslint-disable no-process-env */

import { it, beforeAll, describe, expect } from "@jest/globals";
import { Tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { createOpenAIFunctionsAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { END } from "../index.js";
import {
  createAgentExecutor,
  createFunctionCallingExecutor,
} from "../prebuilt/index.js";

// Tracing slows down the tests
beforeAll(() => {
  process.env.LANGCHAIN_TRACING_V2 = "false";
  process.env.LANGCHAIN_ENDPOINT = "";
  process.env.LANGCHAIN_API_KEY = "";
  process.env.LANGCHAIN_PROJECT = "";
});

describe("createFunctionCallingExecutor", () => {
  it("can call a function", async () => {
    const weatherResponse = `Not too cold, not too hot 😎`;
    const model = new ChatOpenAI();
    class SanFranciscoWeatherTool extends Tool {
      name = "current_weather";

      description = "Get the current weather report for San Francisco, CA";

      constructor() {
        super();
      }

      async _call(_: string): Promise<string> {
        return weatherResponse;
      }
    }
    const tools = [new SanFranciscoWeatherTool()];

    const functionsAgentExecutor = createFunctionCallingExecutor<ChatOpenAI>({
      model,
      tools,
    });

    const response = await functionsAgentExecutor.invoke({
      messages: [new HumanMessage("What's the weather like in SF?")],
    });

    console.log(response);
    // It needs at least one human message, one AI and one function message.
    expect(response.messages.length > 3).toBe(true);
    const firstFunctionMessage = (response.messages as Array<BaseMessage>).find(
      (message) => message._getType() === "function"
    );
    expect(firstFunctionMessage).toBeDefined();
    expect(firstFunctionMessage?.content).toBe(weatherResponse);
  });

  it("can stream a function", async () => {
    const weatherResponse = `Not too cold, not too hot 😎`;
    const model = new ChatOpenAI({
      streaming: true,
    });
    class SanFranciscoWeatherTool extends Tool {
      name = "current_weather";

      description = "Get the current weather report for San Francisco, CA";

      constructor() {
        super();
      }

      async _call(_: string): Promise<string> {
        return weatherResponse;
      }
    }
    const tools = [new SanFranciscoWeatherTool()];

    const functionsAgentExecutor = createFunctionCallingExecutor<ChatOpenAI>({
      model,
      tools,
    });

    const stream = await functionsAgentExecutor.stream({
      messages: [new HumanMessage("What's the weather like in SF?")],
    });
    const fullResponse = [];
    for await (const item of stream) {
      console.log(item);
      console.log("-----\n");
      fullResponse.push(item);
    }

    // Needs at least 3 llm calls, plus one `__end__` call.
    expect(fullResponse.length >= 4).toBe(true);

    const endMessage = fullResponse[fullResponse.length - 1];
    expect(END in endMessage).toBe(true);
    expect(endMessage[END].messages.length > 0).toBe(true);

    const functionCall = endMessage[END].messages.find(
      (message: BaseMessage) => message._getType() === "function"
    );
    expect(functionCall.content).toBe(weatherResponse);
  });
});

describe("createAgentExecutor", () => {
  const tools = [new TavilySearchResults({ maxResults: 3 })];

  it("Can invoke", async () => {
    const prompt = await pull<ChatPromptTemplate>(
      "hwchase17/openai-functions-agent"
    );
    const llm = new ChatOpenAI({ modelName: "gpt-4-0125-preview" });
    const agentRunnable = await createOpenAIFunctionsAgent({
      llm,
      tools,
      prompt,
    });

    const agentExecutor = createAgentExecutor({
      agentRunnable,
      tools,
    });
    console.log(
      await agentExecutor.invoke({
        input: "who is the winnner of the us open",
        steps: [],
      })
    );
  });
});

import {
  Context,
  APIGatewayProxyResult,
  APIGatewayEvent,
  Handler,
} from "aws-lambda";
import { splitRecent20Expenses } from "./main";

export const handler: Handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const {
    SPLITWISE_API_KEY_PARAMETER_NAME,
    SLACK_WEBHOOK_URL,
    USER1_ID,
    USER1_RATE,
    USER2_ID,
    USER2_RATE,
    SPLITWISE_GROUP_ID,
  } = process.env;

  // validation of environment variables
  if (
    SPLITWISE_API_KEY_PARAMETER_NAME === undefined ||
    USER1_ID === undefined ||
    USER1_RATE === undefined ||
    USER2_ID === undefined ||
    USER2_RATE === undefined ||
    SPLITWISE_GROUP_ID === undefined ||
    SLACK_WEBHOOK_URL === undefined
  ) {
    throw new Error("環境変数が設定されていません");
  }

  const resuleMessage = splitRecent20Expenses({
    SPLITWISE_API_KEY_PARAMETER_NAME,
    SLACK_WEBHOOK_URL,
    USER1_ID,
    USER1_RATE,
    USER2_ID,
    USER2_RATE,
    SPLITWISE_GROUP_ID,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: resuleMessage,
    }),
  };
};

import {
  Context,
  APIGatewayProxyResult,
  APIGatewayEvent,
  Handler,
} from "aws-lambda";
import axios from "axios";
import { get } from "https";

export const handler: Handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const { SPLITWISE_API_KEY_PARAMETER_NAME } = process.env;

  const getApiResponse = await axios.get(
    "https://secure.splitwise.com/api/v3.0/get_current_user",
    {
      headers: { Authorization: `Bearer ${SPLITWISE_API_KEY_PARAMETER_NAME}` },
    }
  );

  console.log(JSON.stringify(getApiResponse.data));

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "hello world",
    }),
  };
};

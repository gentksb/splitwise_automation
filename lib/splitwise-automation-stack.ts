import { Stack, StackProps, aws_ssm, Duration } from "aws-cdk-lib";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { ParameterType, StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export class SplitWiseAutomationStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const splitwise_apikey_parameter = new StringParameter(
      this,
      "splitwise_apikey_parameter",
      {
        parameterName: "splitwise_apikey",
        stringValue: "dummy",
        type: ParameterType.STRING,
      }
    );

    const splitwise_expense_automation = new NodejsFunction(
      this,
      "splitwise_expense_automation",
      {
        entry: "lambda/splitwise_get_expenses.ts",
        // parameter storeの直参照はできないので、パラメータ名のみを渡す
        environment: {
          SPLITWISE_API_KEY_PARAMETER_NAME:
            splitwise_apikey_parameter.parameterName,
        },
        runtime: Runtime.NODEJS_16_X,
        logRetention: RetentionDays.ONE_MONTH,
      }
    );

    const invocationSchedule = new Rule(this, "splitwiseWatchRule", {
      schedule: Schedule.rate(Duration.hours(4)),
      targets: [
        new LambdaFunction(splitwise_expense_automation, {
          retryAttempts: 3,
        }),
      ],
    });
  }
}

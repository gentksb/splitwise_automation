import {
  Stack,
  StackProps,
  aws_lambda as lambda,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
  Duration,
} from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

export class StepStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const hellofunction = new NodejsFunction(this, "helloWorld", {
      entry: "lambda/splitwise_get_expenses.ts",
      handler: "get",
      timeout: Duration.seconds(10),
    });

    const stateMachine = new sfn.StateMachine(this, "MyStateMachine", {
      definition: new tasks.LambdaInvoke(this, "MyLambdaTask", {
        lambdaFunction: hellofunction,
      }).next(new sfn.Succeed(this, "GreetedWorld")),
    });
  }
}

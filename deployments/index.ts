import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as dotenv from "dotenv";

// Load in the .env file
dotenv.config({ override: true});

// process cors origines env file
if (!process.env.ALLOWED_CORS_ORIGINS) {
  throw new Error("ALLOWED_CORS_ORIGINS env variable is not set, this is required.");
}

// save it to a variable
const allowedOrigins = process.env.ALLOWED_CORS_ORIGINS.split(',');

if (allowedOrigins.length === 0) {
  throw new Error("ALLOWED_CORS_ORIGINS env variable is empty, a value is required. Provide comma separated origins (including the http / https!)");
}

// Create a private ECR registry
const repository = new awsx.ecr.Repository("codevideo_generator_backend");

// Create a docker image - will be used in the lambda function
const image = new awsx.ecr.Image("codevideo_generator_backend", {
  repositoryUrl: repository.url,
  dockerfile: "./Dockerfile.aws",
  path: "../",
});

// Create a S3 Bucket with public read access, and CORS rules for the frontend
const bucket = new aws.s3.Bucket("codevideos", {
  acl: "public-read",
  corsRules: [
    {
      allowedHeaders: ["*"],
      allowedMethods: ["GET"],
      allowedOrigins,
      exposeHeaders: [],
    },
  ],
});

// Create a role for the lambda function (just an empty role)
const iamForLambda = new aws.iam.Role("iamForLambda", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: "lambda.amazonaws.com",
  }),
});

// Create an IAM policy that grants the s3:PutObject permission to the lambda.
const lambdaS3Policy = new aws.iam.Policy("putPolicy", {
  policy: {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: "s3:PutObject",
        Resource: bucket.arn.apply((arn: string) => `${arn}/*`),
      },
    ],
  },
});

// Attach the s3 policy to the role, which we'll use for the lambda function
new aws.iam.PolicyAttachment("putPolicyAttachment", {
  roles: [iamForLambda],
  policyArn: lambdaS3Policy.arn,
});

// Create an IAM policy for logging from the labmda function
const lambdaLoggingPolicy = new aws.iam.Policy("loggingPolicy", {
  policy: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        Resource: "arn:aws:logs:*:*:*",
        Effect: "Allow",
      },
    ],
  },
});

// Attach the cloudwatch policy to the role, which we'll use for the lambda function
new aws.iam.PolicyAttachment(
  "codevideo_generator_lambda_cloudwatch_policy_attachment",
  {
    roles: [iamForLambda],
    policyArn: lambdaLoggingPolicy.arn,
  }
);

// Attach the image and IAM role to the lambda function
// See docs for this function - https://www.pulumi.com/registry/packages/aws/api-docs/lambda/function/
const lambdaFunction = new aws.lambda.Function("codevideo_generator_backend", {
  role: iamForLambda.arn,
  packageType: "Image",
  imageUri: image.imageUri,
  timeout: 120, // 2 minutes
  memorySize: 1024, // 1GB
});

// Define a FunctionUrl that can be used to invoke the lambda function
const functionUrl = new aws.lambda.FunctionUrl(
  "codevideo_generator_backend_url",
  {
    functionName: lambdaFunction.name,
    authorizationType: "NONE",
    cors: {
      allowOrigins: allowedOrigins,
      allowMethods: ["POST"],
      allowHeaders: ["*"],
    },
  }
);

// export all relevant values
export const containerUrl = repository.url;
export const lambdaImageUri = image.imageUri;
export const bucketId = bucket.id;
export const bucketUrl = bucket.websiteEndpoint;
export const lambdaFunctionUrl = functionUrl.functionUrl;

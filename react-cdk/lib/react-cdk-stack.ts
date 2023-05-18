import * as cdk from 'aws-cdk-lib';
import * as core from 'aws-cdk-lib/core';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

export class ReactCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Add S3 s3.Bucket
    const s3Site = new s3.Bucket(this, `CDK-React-UI`, {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      bucketName: core.PhysicalName.GENERATE_IF_NEEDED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      websiteIndexDocument: 'index.html',
      autoDeleteObjects: true,
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(90),
          expiration: cdk.Duration.days(365),
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
    });

    const oia = new cloudfront.OriginAccessIdentity(this, 'OIA', {
      comment: "Created by JG"
    });
    s3Site.grantRead(oia);

    // Create a new CloudFront Distribution
    const distribution = new cloudfront.CloudFrontWebDistribution(
      this,
      `reactapp-cf-distribution`,
      {
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: s3Site,
              originAccessIdentity: oia
            },
            behaviors: [
              {
                isDefaultBehavior: true,
                compress: true,
                allowedMethods: cloudfront.CloudFrontAllowedMethods.ALL,
                cachedMethods: cloudfront.CloudFrontAllowedCachedMethods.GET_HEAD_OPTIONS,
                forwardedValues: {
                  queryString: true,
                  cookies: {
                    forward: "none"
                  },
                  headers: [
                    "Access-Control-Request-Headers",
                    "Access-Control-Request-Method",
                  ]
                }
              }
            ]
          }
        ],
        comment: `reactapp - Cloudfront Distribution`,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
    );

    // Setup Bucket Deployment to automatically deploy new assets and invalidate cache
    new s3deploy.BucketDeployment(this, 'reactapp-s3bucketdeployment', {
      sources: [s3deploy.Source.asset("../my-react-app/build")],
      destinationBucket: s3Site,
      distribution: distribution,
      distributionPaths: ["/*"],
    });

    // Final Cloudfront URL
    new cdk.CfnOutput(this, "Cloudfront URL", {
      value: distribution.distributionDomainName
    });

  }
}

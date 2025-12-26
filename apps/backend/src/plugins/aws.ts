import fp from 'fastify-plugin';
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { FastifyPluginAsync } from 'fastify';

declare module 'fastify' {
    interface FastifyInstance {
        aws: {
            getSecret: (secretId: string) => Promise<string | undefined>;
        };
    }
}

interface AwsPluginOptions {
    region?: string;
}

const awsPlugin: FastifyPluginAsync<AwsPluginOptions> = async (fastify, _options) => {
    const region = 'us-east-1';

    // Initialize AWS Secrets Manager Client
    // Credentials will be automatically resolved from the environment or default provider chain
    const client = new SecretsManagerClient({ region });

    fastify.decorate('aws', {
        getSecret: async (secretId: string) => {
            try {
                const command = new GetSecretValueCommand({ SecretId: secretId });
                const response = await client.send(command);

                if (response.SecretString) {
                    return response.SecretString;
                }

                // Handle binary secrets if needed, though typically configuration is string
                if (response.SecretBinary) {
                    return Buffer.from(response.SecretBinary).toString('utf-8');
                }

                return undefined;
            } catch (error) {
                fastify.log.error(error, `Failed to retrieve secret ${secretId} from AWS Secrets Manager`);
                throw error;
            }
        }
    });
};

export default fp(awsPlugin, {
    name: 'aws-secrets-manager',
});

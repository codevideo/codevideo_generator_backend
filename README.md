# codevideo_generator_backend

The backend engine of codevideo.io used to generate code videos.

## Run Locally

First, ensure you have a `.env` file in the root. You can use the `.env.example` file as a template: 

```shell
cp .env.example .env
```

Make sure to define all values there. To save you (and us) headaches, you should also copy the `.env` file to the `deployments` directory:

```shell
cp .env deployments/.env
```

(We're working on sourcing everything from the root `.env` file.)

With your env setup, install dependencies:

```shell
npm install
```

Run the server:

```shell
npm start
```

The server should be accessible at `http://localhost:<<PORT>>`, where `<<PORT>>` is the value of the `PORT` environment variable you've selected.

# On Premise / Local Docker Deployment

`codevideo_generator_backend` also ships as a completely standalone docker image. To build and run it, run the following command:

```shell
source .env &&
docker build -t codevideo_generator_backend --build-arg port=$PORT -f deployments/Dockerfile.local . &&
docker run -d -p $PORT:$PORT codevideo_generator_backend 
```

The container `codevideo_generator_backend` should then be up and running, accessible at `http://localhost:<<PORT>>`, where `<<PORT>>` is the value of the `PORT` environment variable you've set in `.env`. It's up to you to configure further network stuff such as a reverse proxy, SSL, etc. Note the difference here from AWS deployment in that the serverless handler is not the entrypoint of the container, but rather just the `npm start` command.

## Local AWS Deployment

If you want to deploy the AWS docker image locally, you can do so by running the following command:

```shell
source .env &&
docker build -t codevideo_generator_backend --build-arg port=$PORT -f deployments/Dockerfile.aws . &&
docker run -d -p $PORT:$PORT codevideo_generator_backend
```

## AWS Deployment

***AWS tooling is more than... elegant. We are hoping to get an AWS lambda deploy working. Until then, see the complete nginx stack deploy section below***

AWS deployment is managed by pulumi within the `deployments` directory. It handles truly everything, from user creation, roles, and so on. To get started, first ensure pulumi is installed:

```shell
brew install pulumi/tap/pulumi
```

Then ensure you have a `.env` file in the `deployments` directory. You can use the `.env.example` file as a template:

```shell
cp deployments/.env.example deployments/.env
```

Then, make sure to define all values there.

You should then be able to run the following commands to deploy the app:

```shell
cd deployments &&
source .env && 
pulumi up --yes
```

If all goes well, you should see pulumi begin to deploy your stack.

## Complete Nginx Stack Deploy

If you want to deploy the entire stack, including nginx, you can do so by running the following command:

```shell
source .env && docker-compose -f deployments/docker-compose.yml up -d
```

### Certs for your stack

Note - the certification process assumes you have two domains, one of them having a `staging.` subdomain prefix. If you don't want this pattern, you'll need to modify `nginx/conf.d/api.conf` and `nginx/conf.d/staging.api.conf` to match your domain names.

Move into deployment directory:

```shell
cd deployments
```

Download the helper script:

```shell
curl -L https://raw.githubusercontent.com/wmnnd/nginx-certbot/master/init-letsencrypt.sh > init-letsencrypt.sh
```

Open the script and edit the following lines:

```shell
domains=(YOUR_DOMAIN_ONE YOUR_DOMAIN_TWO)
data_path="./volumes/certbot"
email="<<YOUR_EMAIL>>" # Adding a valid address is strongly recommended
staging=0 # Set to 1 if you're testing your setup to avoid hitting request limits
```

Allow execution of the script:

```shell
chmod +x init-letsencrypt.sh
```

Run the script:

```shell
./init-letsencrypt.sh
```

# @base-cms/scripts
A collection of post-import cleanup scripts

## Usage
This package provides an interactive CLI for selecting and running scripts.

To get started, you _must_ specify the following variables in a `.env` file at the root of this project:
- `TENANT_KEY`: The Base CMS tenant key to access
- `MONGO_DSN`: The Base CMS mongo connection string (defaults to docker compose mongo instance)

To enter the CLI, execute one of the following from the root of the project:
- `yarn start`

## Contributing

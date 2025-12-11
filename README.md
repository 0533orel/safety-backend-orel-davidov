# Safety Backend – Orel Davidov

Backend service for a safety-related application, built with Node.js and TypeScript.  
The project is structured with a clear separation between configuration, entities, controllers, services, middleware, and routing.

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Node.js
- **Framework:** Express (HTTP server, routing, middleware)
- **ORM / Data Layer:** TypeORM or similar (entities, migrations)
- **Build / Config:** `tsconfig.json`, npm scripts (`package.json`)

> Note: The exact libraries are defined in `package.json` (dependencies and scripts).

## Project Structure

- `src/app.ts`  
  Application entry point. Initializes the Express app, applies global middleware, connects configuration (database, environment), and mounts routes.

- `src/config/`  
  Environment and application configuration:
  - Database connection settings
  - Environment variables handling
  - Possibly logging and other global config

- `src/entities/`  
  Domain models mapped to database tables (e.g. users, incidents, reports, safety checks).  
  Each entity typically includes:
  - Columns and types
  - Relations between entities
  - Validation rules at the model level

- `src/migrations/`  
  Database migration files for evolving the schema:
  - Creating and altering tables
  - Adding or removing columns and indexes
  - Data corrections when needed

- `src/controllers/`  
  Request handlers for each resource:
  - Parse and validate incoming requests
  - Delegate business logic to services
  - Map service results to HTTP responses (status codes, JSON payloads)
  - Handle basic error mapping (e.g. 400, 401, 404, 500)

- `src/services/`  
  Business logic and interaction with the data layer:
  - Implement safety-related use cases (e.g. create incident, update status, fetch reports)
  - Orchestrate entities, repositories, and external integrations
  - Enforce domain rules and invariants

- `src/middleware/`  
  Cross-cutting HTTP concerns:
  - Authentication and authorization
  - Request logging
  - Error handling
  - Input validation (if not done at controller level)

- `src/routes/`  
  Route definitions that wire HTTP paths to controllers and middleware, for example:
  - `POST /api/incidents`
  - `GET /api/incidents/:id`
  - `PUT /api/incidents/:id`
  - Auth-related routes (if implemented)

## Getting Started

### Prerequisites

- Node.js (LTS version recommended)
- npm
- A compatible database (configured in `src/config` and environment variables)

### Installation

```bash
git clone https://github.com/0533orel/safety-backend-orel-davidov.git
cd safety-backend-orel-davidov
npm install
```

### Configuration

1. Create an environment file (for example `.env`) or configure environment variables as expected by the project:
   - Database connection parameters
   - Port and host
   - Any authentication / JWT secrets or external API keys

2. Verify or adjust config files in `src/config/` to match your environment.

### Database Migrations

Run database migrations before starting the server in a non-empty environment (exact command may vary depending on ORM setup):

```bash
npm run migration:run
# or
npm run typeorm migration:run
```

Check `package.json` for the precise script name.

### Running the Application

#### Development

```bash
npm run dev
```

This typically runs the TypeScript source directly with a watcher (e.g. `ts-node-dev` or `nodemon`).

#### Production

Build and run the compiled JavaScript:

```bash
npm run build
npm start
```

The server will start on the port defined in your configuration or environment variables.

## API Overview

The backend exposes RESTful endpoints under a common base path (for example `/api`).  
Typical groups of endpoints (depending on the implemented controllers):

- **Authentication & Users**
  - Register, login, and manage user profiles
  - Protect routes with auth middleware

- **Safety Incidents / Reports**
  - Create and update incidents or safety reports
  - List, filter, and retrieve details
  - Change statuses and assign responsibility

- **Auxiliary Resources**
  - Reference data used in the safety domain (e.g. locations, categories)

Refer to route definitions under `src/routes/` and controllers in `src/controllers/` for the exact API surface.

## Error Handling

- Centralized error handling via middleware in `src/middleware/`
- Maps domain and validation errors to appropriate HTTP status codes
- Returns structured error responses (JSON) to clients

## Scripts

Common scripts defined in `package.json` may include:

- `npm run dev` – Start development server
- `npm run build` – Compile TypeScript to JavaScript
- `npm start` – Start compiled server
- `npm test` – Run tests (if defined)
- Migration-related scripts (e.g. `migration:run`, `migration:revert`)

Check `package.json` for the complete list and exact names.

## Development Guidelines

- Keep business logic inside `services` and leave controllers thin.
- Use `entities` and `migrations` together to manage database schema changes safely.
- Add new features by:
  1. Designing or updating entities.
  2. Creating migrations.
  3. Implementing service methods.
  4. Exposing endpoints via controllers and route files.
  5. Securing them with middleware when necessary.

## License

Specify the license here if applicable (for example MIT, Apache 2.0).  
If no license file is present, the repository is by default “all rights reserved”.

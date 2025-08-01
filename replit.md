# Overview

NASRECO is a comprehensive healthcare management system designed for nursing and care facilities. The application provides Japanese language support and manages all aspects of resident care including personal information, care records, nursing documentation, vital signs monitoring, meal and medication tracking, and various daily care activities. Built as a full-stack web application, it serves healthcare staff with an intuitive interface for comprehensive patient care documentation and management.

## Recent Changes (January 2025)
- Successfully implemented and tested core functionality including vital signs recording, care records management, meals/medication tracking, and resident registration
- Fixed critical date field validation issues in Zod schemas by adding proper string-to-date transformations
- Resolved null value handling errors in optional fields across all record types
- Confirmed all major modules are working properly with live testing
- Enhanced care records interface with inline editing, date filtering, and improved card layout
- Implemented care record detail screen with file attachment functionality (PDF/image upload)
- Added proper user information display with gender translation and record creator identification
- Optimized record sorting and new record creation workflow

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built with React and TypeScript, using a modern component-based architecture:
- **Framework**: React with TypeScript for type safety
- **Styling**: Tailwind CSS with custom healthcare-themed color schemes and shadcn/ui components
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **Forms**: React Hook Form with Zod validation for robust form handling
- **Build Tool**: Vite for fast development and optimized production builds

## Backend Architecture
The backend follows a RESTful API design pattern:
- **Framework**: Express.js with TypeScript for type-safe server development
- **Database Layer**: Drizzle ORM for type-safe database operations
- **API Structure**: Modular route handlers with centralized storage abstraction
- **Middleware**: Request logging, error handling, and authentication middleware

## Authentication System
- **Provider**: Replit Auth integration with OpenID Connect
- **Session Management**: PostgreSQL-backed session storage using connect-pg-simple
- **Security**: HTTP-only cookies with secure session handling
- **Authorization**: Role-based access control (staff, nurse, admin roles)

## Database Design
- **Database**: PostgreSQL with connection pooling via Neon serverless
- **ORM**: Drizzle ORM for schema management and type-safe queries
- **Schema**: Comprehensive healthcare data model including:
  - User management and authentication
  - Resident/patient information
  - Multiple care record types (care, nursing, vitals, meals, bathing, etc.)
  - Audit trails with timestamps and user tracking

## UI/UX Architecture
- **Design System**: shadcn/ui components with healthcare-specific customizations
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Accessibility**: ARIA compliant components and keyboard navigation
- **Internationalization**: Japanese language support with date-fns locale integration

## Development Architecture
- **Monorepo Structure**: Shared schemas and types between client and server
- **Hot Reload**: Vite HMR for rapid development iteration
- **Type Safety**: End-to-end TypeScript with shared type definitions
- **Code Organization**: Feature-based folder structure with clear separation of concerns

# External Dependencies

## Core Infrastructure
- **Database**: Neon PostgreSQL serverless database for scalable data storage
- **Authentication**: Replit Auth service for user authentication and authorization
- **Session Storage**: PostgreSQL-backed session management

## Frontend Libraries
- **UI Framework**: React with extensive Radix UI primitives for accessible components
- **Styling**: Tailwind CSS for utility-first styling approach
- **Form Management**: React Hook Form with Hookform Resolvers for validation integration
- **Data Fetching**: TanStack React Query for efficient server state management
- **Date Handling**: date-fns with Japanese locale support for internationalization
- **Icons**: Lucide React for consistent iconography

## Backend Dependencies
- **Database ORM**: Drizzle ORM with PostgreSQL dialect for type-safe database operations
- **Authentication**: Passport.js with OpenID Connect strategy for Replit Auth integration
- **Session Management**: Express Session with connect-pg-simple for PostgreSQL session storage
- **Validation**: Zod for runtime type validation and schema generation
- **Development**: tsx for TypeScript execution and hot reloading

## Build and Development Tools
- **Build System**: Vite for fast development and optimized production builds
- **TypeScript**: Comprehensive type checking across the entire application stack
- **Database Migrations**: Drizzle Kit for schema management and database migrations
- **Development Environment**: Replit-specific plugins for enhanced development experience
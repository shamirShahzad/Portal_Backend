import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from "./routes/userRouter";
import errorMiddleware from "./middlewares/errorMiddleware";
import courseRouter from "./routes/courseRouter";
import path from "path";
import applicationRouter from "./routes/applicationRouter";
import documentRouter from "./routes/documentRouter";
import managerApprovalRouter from "./routes/managerApprovalRouter";
import exportRouter from "./routes/exportRouter";
import { exportProcessor } from "./util/exportProcessor";
import pool from "./db/config";
import { Server } from "http";

const app = express();
const port = process.env.PORT || 3000;

// Global error handlers for unhandled errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit immediately, log and continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit immediately, log and continue
});

// Request timeout middleware
app.use((req, res, next) => {
  // Set timeout for all requests (30 seconds)
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        message: 'Request timeout',
        statusCode: 408
      });
    }
  }, 30000);

  // Clear timeout when response is sent
  res.on('finish', () => {
    clearTimeout(timeout);
  });

  next();
});

// Request size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

//CORS with proper error handling
app.use(cors({ 
  origin: process.env.CORS || "http://localhost:3000", 
  credentials: true 
}));

//Middlewares
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Wrap routes in error handling
app.use("/api/v1/users", userRouter);
app.use("/api/v1/courses", courseRouter);
app.use("/api/v1/applications", applicationRouter);
app.use("/api/v1/documents", documentRouter);
app.use("/api/v1/manager-approval", managerApprovalRouter);
app.use("/api/v1/exports", exportRouter);

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    // Check database connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'connected'
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error?.message || 'Unknown error'
    });
  }
});

app.get("/", (req, res) => res.send("Hello World!"));
app.get("/confirm", (req, res) => res.send("Confirm endpoint"));

// Error middleware (must be last)
app.use(errorMiddleware);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    statusCode: 404
  });
});

// Graceful shutdown handling
let server: Server | undefined;
let isShuttingDown = false;

const gracefulShutdown = async () => {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    console.log('Shutdown already in progress, ignoring additional signals...');
    return;
  }
  
  isShuttingDown = true;
  console.log('Received shutdown signal, gracefully shutting down...');
  
  // Set a timeout to force exit if shutdown takes too long
  const forceExitTimeout = setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit...');
    process.exit(1);
  }, 10000); // 10 seconds timeout
  
  try {
    // Stop accepting new connections
    if (server) {
      server.close(() => {
        console.log('HTTP server closed');
      });
    }
    
    // Stop export processor
    console.log('Shutting down export processor...');
    try {
      await exportProcessor.stop();
      console.log('Export processor stopped successfully');
    } catch (error) {
      console.error('Error stopping export processor:', error);
    }
    
    // Close database connections
    try {
      await pool.end();
      console.log('Database connections closed');
    } catch (error) {
      console.error('Error closing database connections:', error);
    }
    
    // Clear the force exit timeout
    clearTimeout(forceExitTimeout);
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
};

// Start the export processor with error handling
const startServer = async () => {
  try {
    exportProcessor.start();
    console.log('Export processor started successfully');
  } catch (error) {
    console.error('Failed to start export processor:', error);
  }
  
  server = app.listen(port, () => {
    console.log(`Server listening on port ${port}!`);
    console.log(`Health check available at http://localhost:${port}/health`);
  });
  
  // Handle server errors
  server.on('error', (error) => {
    console.error('Server error:', error);
  });
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the server
startServer();

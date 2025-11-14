import morgan from "morgan";
import chalk from "chalk";
import { Request, Response } from "express";

// Custom tokens
morgan.token("date", () => {
  const now = new Date();
  return now.toLocaleString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
});

morgan.token("colored-method", (req: Request) => {
  const method = req.method;
  switch (method) {
    case "GET":
      return chalk.green(method);
    case "POST":
      return chalk.blue(method);
    case "PUT":
      return chalk.yellow(method);
    case "DELETE":
      return chalk.red(method);
    case "PATCH":
      return chalk.magenta(method);
    default:
      return chalk.white(method);
  }
});

morgan.token("colored-status", (_req: Request, res: Response) => {
  const status = res.statusCode;
  if (status >= 500) {
    return chalk.red.bold(status.toString());
  } else if (status >= 400) {
    return chalk.yellow.bold(status.toString());
  } else if (status >= 300) {
    return chalk.cyan(status.toString());
  } else if (status >= 200) {
    return chalk.green(status.toString());
  }
  return chalk.white(status.toString());
});

morgan.token("colored-url", (req: Request) => {
  return chalk.white.underline(req.url);
});

morgan.token("response-time-colored", (req: Request, res: Response) => {
  const responseTime = (morgan as any)['response-time'](req, res);
  if (!responseTime) return '-';

  const time = parseFloat(responseTime);
  if (time > 1000) {
    return chalk.red(`${responseTime} ms`);
  } else if (time > 500) {
    return chalk.yellow(`${responseTime} ms`);
  } else {
    return chalk.gray(`${responseTime} ms`);
  }
});

// Custom format
const customFormat =
  chalk.gray("[") + ":date" + chalk.gray("]") + " :colored-method :colored-url :colored-status :response-time-colored";

// Export configured morgan middleware
export const loggerMiddleware = morgan(customFormat);

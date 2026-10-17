import { Router } from 'express';
import { pullManager } from '../services/pullManager.js';

export const pullRouter = Router();

/**
 * POST /pulls
 * Initiate an asynchronous mock BSE trade pull.
 * 
 * Request Body (JSON, optional):
 * - durationSeconds: integer [1, 900] (default: 5)
 * - recordCount:     integer [1, 5000] (default: 500)
 * - simulateFailure: boolean (default: false)
 * 
 * Returns:
 * - 202 Accepted: Pull successfully started; executes in background.
 * - 400 Bad Request: Invalid input parameters.
 * - 409 Conflict: Another pull is currently active.
 */
pullRouter.post('/', (req, res) => {
  const { durationSeconds = 5, recordCount = 500, simulateFailure = false } = req.body || {};
  const errors = [];

  // Validate durationSeconds
  if (durationSeconds !== undefined) {
    const isInt = Number.isInteger(durationSeconds) || (typeof durationSeconds === 'string' && /^\d+$/.test(durationSeconds));
    const parsedDur = parseInt(durationSeconds, 10);
    if (!isInt || isNaN(parsedDur) || parsedDur < 1 || parsedDur > 900) {
      errors.push("'durationSeconds' must be an integer between 1 and 900");
    }
  }

  // Validate recordCount
  if (recordCount !== undefined) {
    const isInt = Number.isInteger(recordCount) || (typeof recordCount === 'string' && /^\d+$/.test(recordCount));
    const parsedCount = parseInt(recordCount, 10);
    if (!isInt || isNaN(parsedCount) || parsedCount < 1 || parsedCount > 5000) {
      errors.push("'recordCount' must be an integer between 1 and 5000");
    }
  }

  // Validate simulateFailure
  if (simulateFailure !== undefined && typeof simulateFailure !== 'boolean') {
    errors.push("'simulateFailure' must be a boolean (true or false)");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid pull parameters',
      details: errors
    });
  }

  const result = pullManager.startPull({
    durationSeconds: parseInt(durationSeconds, 10),
    recordCount: parseInt(recordCount, 10),
    simulateFailure: Boolean(simulateFailure)
  });

  if (result.conflict) {
    return res.status(409).json({
      success: false,
      error: 'A trade pull operation is already in progress',
      activePull: result.activePull
    });
  }

  return res.status(202).json({
    success: true,
    message: 'BSE trade pull operation initiated',
    pull: result.pull
  });
});

/**
 * GET /pulls/:id
 * Retrieve status and progress of a specific pull.
 */
pullRouter.get('/:id', (req, res) => {
  const pull = pullManager.getPull(req.params.id);
  if (!pull) {
    return res.status(404).json({
      success: false,
      error: 'Pull operation not found',
      pullId: req.params.id
    });
  }

  return res.status(200).json({
    success: true,
    pull
  });
});

/**
 * GET /pulls
 * Retrieve active pull and recent history.
 */
pullRouter.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    activePull: pullManager.getActivePull(),
    recentPulls: pullManager.getRecentPulls()
  });
});

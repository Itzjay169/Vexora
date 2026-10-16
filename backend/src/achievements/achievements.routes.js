import { Router } from 'express';
import { authenticate } from '../common/auth.middleware.js';
import { query } from '../common/database.js';

export const achievementsRouter = Router();

// All achievement endpoints require auth
achievementsRouter.use(authenticate);

// ─── GET / — List all available achievements ─────────────────────────────
achievementsRouter.get('/', async (req, res, next) => {
  try {
    const category = req.query.category;
    let whereClause = '';
    const params = [];

    if (category) {
      params.push(category.toUpperCase());
      whereClause = `WHERE a.category = $1`;
    }

    const result = await query(
      `SELECT a.id, a.slug, a.title, a.description, a.category, a.icon_url,
              a.xp_reward, a.coin_reward, a.tier,
              ua.unlocked_at, ua.progress
       FROM achievements a
       LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = $${params.length + 1}
       ${whereClause}
       ORDER BY a.tier ASC, a.title ASC`,
      [...params, req.user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /me — User's unlocked achievements ──────────────────────────────
achievementsRouter.get('/me', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT a.id, a.slug, a.title, a.description, a.category, a.icon_url,
              a.xp_reward, a.coin_reward, a.tier,
              ua.unlocked_at, ua.progress
       FROM user_achievements ua
       JOIN achievements a ON a.id = ua.achievement_id
       WHERE ua.user_id = $1
       ORDER BY ua.unlocked_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /summary — User's achievement stats ─────────────────────────────
achievementsRouter.get('/summary', async (req, res, next) => {
  try {
    const [total, unlocked, xp] = await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM achievements`),
      query(
        `SELECT COUNT(*)::int AS count FROM user_achievements WHERE user_id = $1 AND unlocked_at IS NOT NULL`,
        [req.user.id]
      ),
      query(
        `SELECT COALESCE(SUM(a.xp_reward), 0)::int AS total_xp
         FROM user_achievements ua
         JOIN achievements a ON a.id = ua.achievement_id
         WHERE ua.user_id = $1 AND ua.unlocked_at IS NOT NULL`,
        [req.user.id]
      ),
    ]);

    res.json({
      success: true,
      data: {
        totalAchievements: total.rows[0].count,
        unlockedCount: unlocked.rows[0].count,
        totalXpEarned: xp.rows[0].total_xp,
        completionPercentage: total.rows[0].count > 0
          ? Math.round((unlocked.rows[0].count / total.rows[0].count) * 100)
          : 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

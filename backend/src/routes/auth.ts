import { Router, Request, Response } from 'express';
import { authMiddleware, requireCompany } from '../middleware';
import { userService, companyService } from '../services/UserCompanyService';
import { z } from 'zod';

const router = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = registerSchema.parse(req.body);
    const result = await userService.register(username, email, password);
    if (!result) {
      return res.status(400).json({ error: '用户名或邮箱已存在' });
    }
    const { user, token } = result;
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
      },
    });
  } catch (e: any) {
    res.status(400).json({ error: e.errors || e.message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const result = await userService.login(username, password);
    if (!result) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const { user, token } = result;
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
      },
    });
  } catch (e: any) {
    res.status(400).json({ error: e.errors || e.message });
  }
});

router.get('/me', authMiddleware, (req: Request, res: Response) => {
  const user = userService.getUserById(req.user!.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    company_id: user.company_id,
  });
});

router.post('/companies', authMiddleware, (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: '请输入商会名称' });

  const company = companyService.createCompany(req.user!.id, name);
  if (!company) return res.status(400).json({ error: '商会名称已存在或您已加入其他商会' });
  res.json(company);
});

router.post('/companies/:id/join', authMiddleware, (req: Request, res: Response) => {
  const success = companyService.joinCompany(req.user!.id, req.params.id);
  if (!success) return res.status(400).json({ error: '无法加入商会' });
  res.json({ success: true });
});

router.get('/companies/:id', authMiddleware, (req: Request, res: Response) => {
  const company = companyService.getCompanyById(req.params.id);
  if (!company) return res.status(404).json({ error: '商会不存在' });
  res.json(company);
});

router.get('/my/company', authMiddleware, requireCompany, (req: Request, res: Response) => {
  const company = companyService.getCompanyById(req.user!.company_id!);
  const departments = companyService.getDepartments(req.user!.company_id!);
  const members = userService.getCompanyMembers(req.user!.company_id!);
  res.json({ company, departments, members });
});

router.get('/my/company/members', authMiddleware, requireCompany, (req: Request, res: Response) => {
  res.json(userService.getCompanyMembers(req.user!.company_id!));
});

router.put('/members/:userId/role', authMiddleware, requireCompany, (req: Request, res: Response) => {
  if (!['president', 'vice_president', 'finance_officer', 'director', 'member'].includes(req.body.role)) {
    return res.status(400).json({ error: '无效角色' });
  }
  const success = userService.updateUserRole(req.params.userId, req.user!.company_id!, req.body.role);
  res.json({ success });
});

router.put('/departments/:type/director', authMiddleware, requireCompany, (req: Request, res: Response) => {
  const deptTypes = ['transport', 'finance', 'intelligence', 'culture'];
  if (!deptTypes.includes(req.params.type)) {
    return res.status(400).json({ error: '无效事业部类型' });
  }
  const success = companyService.appointDirector(req.user!.company_id!, req.params.type as any, req.body.directorId);
  res.json({ success });
});

router.post('/departments/:type/upgrade', authMiddleware, requireCompany, (req: Request, res: Response) => {
  const deptTypes = ['transport', 'finance', 'intelligence', 'culture'];
  if (!deptTypes.includes(req.params.type)) {
    return res.status(400).json({ error: '无效事业部类型' });
  }
  const success = companyService.upgradeDepartment(req.user!.company_id!, req.params.type as any);
  if (!success) return res.status(400).json({ error: '升级失败，资产不足' });
  res.json({ success });
});

router.put('/departments/:type/budget', authMiddleware, requireCompany, (req: Request, res: Response) => {
  const deptTypes = ['transport', 'finance', 'intelligence', 'culture'];
  if (!deptTypes.includes(req.params.type)) {
    return res.status(400).json({ error: '无效事业部类型' });
  }
  const success = companyService.setDepartmentBudget(req.user!.company_id!, req.params.type as any, req.body.budget);
  res.json({ success });
});

export default router;

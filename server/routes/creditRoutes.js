import express from 'express'
import { getPlans, purchasePlan, verifyPayment } from '../controllers/creditController.js'
import { protect } from '../middlewares/auth.js'   // ungal auth middleware name/path

const creditRouter = express.Router()

creditRouter.get('/plan', getPlans)
creditRouter.post('/purchase', protect, purchasePlan)
creditRouter.post('/verify', protect, verifyPayment)

export default creditRouter
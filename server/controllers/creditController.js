import Transaction from "../models/Transaction.js"
import Razorpay from "razorpay"
import crypto from "crypto"
import User from "../models/user.js"

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
})


const plans = [
    {
        _id: "basic",
        name: "Basic",
        price: 10,
        credits: 100,
        features: ['100 text generations', '50 image generations', 'Standard support', 'Access to basic models']
    },
    {
        _id: "pro",
        name: "Pro",
        price: 20,
        credits: 500,
        features: ['500 text generations', '200 image generations', 'Priority support', 'Access to pro models', 'Faster response time']
    },
    {
        _id: "premium",
        name: "Premium",
        price: 30,
        credits: 1000,
        features: ['1000 text generations', '500 image generations', '24/7 VIP support', 'Access to premium models', 'Dedicated account manager']
    }
]

// API Controller for getting all plans
export const getPlans = async (req, res) => {
    try  {
        res.json({success: true, plans})
    } catch (error) {
        res.json({success: false, message: error.message})
    }
}

// API Controller for purchasing a plan
export const purchasePlan = async (req, res) => {
    try {
        const { planId } = req.body
        const userId = req.user._id
        const plan = plans.find(plan => plan._id === planId)

        if(!plan){
            return res.json({success: false, message: "Invalid plan"})
        }

        // Create new Transaction
        const transaction = await Transaction.create({
            userId: userId,
            planId: plan._id,
            amount: plan.price,
            credits: plan.credits,
            isPaid: false
        })

        // Razorpay paise-la edukum, so ×100. Currency INR use pannunga
        const order = await razorpay.orders.create({
            amount: plan.price * 100,
            currency: "INR",
            receipt: transaction._id.toString()
        })

        transaction.razorpayOrderId = order.id
        await transaction.save()

        res.json({
            success: true,
            order,
            transactionId: transaction._id,
            keyId: process.env.RAZORPAY_KEY_ID
        })
        
    } catch (error) {
        res.json({success: false, message: error.message})
    }
}

// Verify: payment nijamave nadandhucha nu check pannum
export const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, transactionId } = req.body

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex")

        if (expectedSignature !== razorpay_signature) {
            return res.json({success: false, message: "Payment verification failed"})
        }

        const transaction = await Transaction.findOne({
            _id: transactionId,
            userId: req.user._id,
            razorpayOrderId: razorpay_order_id
        })

        if (!transaction) {
            return res.json({success: false, message: "Transaction not found"})
        }
        if (transaction.isPaid) {
            return res.json({success: true, message: "Already processed"})
        }

        transaction.isPaid = true
        await transaction.save()

        await User.updateOne({_id: transaction.userId}, {$inc: {credits: transaction.credits}})

        res.json({success: true, message: "Credits added"})
    } catch (error) {
        res.json({success: false, message: error.message})
    }
}
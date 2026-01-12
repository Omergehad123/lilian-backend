// 1. CREATE MYFATOORAH PAYMENT - UPDATED
const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("📥 FULL REQUEST BODY:", JSON.stringify(req.body, null, 2));

    // ✅ Handle BOTH frontend payload structures
    const amountRaw = req.body.amount || req.body.orderData?.totalAmount;
    const customerName =
      req.body.customerName || req.body.orderData?.userInfo?.name;
    const customerEmail =
      req.body.customerEmail || req.body.orderData?.customerEmail;
    const phone = req.body.phone || req.body.orderData?.userInfo?.phone;
    const userId =
      req.body.userId || req.body.orderData?.user?._id || req.user?._id;

    // ✅ STRICT VALIDATION
    if (!amountRaw || !customerName || !customerEmail) {
      console.log("❌ MISSING:", {
        amountRaw,
        customerName,
        customerEmail,
        userId,
      });
      return res.status(400).json({
        isSuccess: false,
        message: `Missing: amount=${!!amountRaw}, name=${!!customerName}, email=${!!customerEmail}`,
      });
    }

    const amount = parseFloat(amountRaw);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        isSuccess: false,
        message: `Invalid amount: ${amountRaw} → ${amount}`,
      });
    }

    console.log(`✅ VALIDATED: ${amount} KWD for ${customerName}`);

    // ✅ Environment check
    if (!process.env.MYFATOORAH_API_KEY) {
      console.error("❌ NO API KEY in .env");
      return res.status(500).json({
        isSuccess: false,
        message: "Payment gateway not configured",
      });
    }

    // 1. INITIATE PAYMENT - فقط لجلب طرق الدفع
    const initiateRes = await axios.post(
      `${process.env.MYFATOORAH_BASE_URL}/v2/InitiatePayment`,
      {
        InvoiceAmount: amount,
        CurrencyIso: "KWD",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    console.log("✅ Initiate:", initiateRes.data.IsSuccess);

    if (!initiateRes.data.IsSuccess) {
      throw new Error(`Initiate failed: ${initiateRes.data.Message}`);
    }

    // ✅ NEW: Return payment methods for user selection
    const paymentMethods = initiateRes.data.Data.PaymentMethods || [];

    // Filter only active and popular methods
    const filteredMethods = paymentMethods.filter(
      (method) => method.IsEnabled && method.PaymentMethodDisplayName
    );

    console.log(`✅ Available payment methods: ${filteredMethods.length}`);

    // Store temporary invoice data in session or cache (optional)
    // TODO: Save initiateRes.data.Data.InvoiceId to Redis/session if needed

    res.json({
      isSuccess: true,
      paymentMethods: filteredMethods.map((method) => ({
        id: method.PaymentMethodId,
        name:
          method.PaymentMethodDisplayName || method.PaymentMethodEnglishName,
        logo: method.PaymentGatewayLogo || null,
        description: method.Description || null,
      })),
      invoiceId: initiateRes.data.Data.InvoiceId,
      amount,
      customerName,
      customerEmail,
      phone,
      userId,
    });
  } catch (error) {
    console.error("💥 DETAILED ERROR:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: error.config?.url,
    });

    res.status(500).json({
      isSuccess: false,
      message: error.response?.data?.Message || error.message,
    });
  }
};

// 2. NEW ENDPOINT: Execute payment after method selection
const executeSelectedPayment = async (req, res) => {
  try {
    const {
      paymentMethodId,
      invoiceId,
      amount,
      customerName,
      customerEmail,
      phone,
      userId,
      orderData,
    } = req.body;

    if (!paymentMethodId || !invoiceId || !amount) {
      return res.status(400).json({
        isSuccess: false,
        message: "Missing required payment data",
      });
    }

    // ✅ EXECUTE PAYMENT مع الطريقة المختارة
    const executeRes = await axios.post(
      `${process.env.MYFATOORAH_BASE_URL}/v2/ExecutePayment`,
      {
        PaymentMethodId: paymentMethodId,
        InvoiceValue: parseFloat(amount),
        CustomerName: customerName,
        CustomerEmail: customerEmail,
        CustomerMobile: phone || "96500000000",
        CallBackUrl: `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/payment/success`,
        ErrorUrl: `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/payment/failed`,
        NotificationOption: "ALL",
        UserDefinedField: JSON.stringify({
          userId,
          orderData,
          invoiceId,
        }),
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    if (!executeRes.data.IsSuccess || !executeRes.data.Data.PaymentURL) {
      console.error("❌ Execute failed:", executeRes.data);
      throw new Error(`Execute failed: ${executeRes.data.Message}`);
    }

    console.log("✅ SUCCESS PaymentURL:", executeRes.data.Data.PaymentURL);

    res.json({
      isSuccess: true,
      paymentUrl: executeRes.data.Data.PaymentURL,
    });
  } catch (error) {
    console.error("💥 Execute Payment ERROR:", error);
    res.status(500).json({
      isSuccess: false,
      message: error.response?.data?.Message || error.message,
    });
  }
};

module.exports = {
  createMyFatoorahPayment,
  executeSelectedPayment,
  handlePaymentSuccess,
  handleWebhook,
};

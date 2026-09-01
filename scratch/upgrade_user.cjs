require('dotenv').config();
const mongoose = require('mongoose');

async function upgradeUser() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year from now

  const user = await mongoose.connection.collection('users').findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId('6a323f1d112eec615ff8ed41') },
    {
      $set: {
        subscriptionStatus: 'active',
        subscriptionPlan: 'premium',
        subscriptionExpiry: expiryDate
      }
    },
    { returnDocument: 'after' }
  );

  console.log('User upgraded:', user);

  await mongoose.disconnect();
}

upgradeUser().catch(console.error);

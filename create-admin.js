import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
const uri = "mongodb+srv://kotiboxserver_db_user:pS4U8tbfpRGZcPRz@cluster0.7opughx.mongodb.net/streamvault";
async function createAdmin() {
    await mongoose.connect(uri);
    const email = "admin@tripleminds.co";
    const password = "AdminPassword123!";
    const passwordHash = await bcrypt.hash(password, 12);
    const db = mongoose.connection.db;
    if (!db)
        throw new Error("DB not connected");
    const result = await db.collection('adminusers').insertOne({
        email: email,
        name: "New Super Admin",
        passwordHash: passwordHash,
        role: "superadmin",
        isActive: true,
        loginCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        modulePermissions: {
            movies: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            shows: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            shortDramas: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            genres: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            actors: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            directors: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            languages: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            categories: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            mediaLibrary: { canView: true, canUpload: true, canDelete: true },
            banners: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            promotions: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            influencers: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            ads: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            pages: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            faqs: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            subscriptions: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            subscriptionPlans: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            planLimits: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            notifications: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            notificationTemplates: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            settings: { canView: true, canCreate: true, canEdit: true, canDelete: true },
            reviews: { canView: true, canCreate: true, canEdit: true, canDelete: true }
        }
    });
    console.log("Created successfully!");
    console.log("ID:", email);
    console.log("Password:", password);
    process.exit(0);
}
createAdmin().catch(console.error);

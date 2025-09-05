-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contacts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "name" TEXT,
    "whatsapp_exists" BOOLEAN,
    "whatsapp_jid" TEXT,
    "whatsapp_status" TEXT,
    "whatsapp_picture" TEXT,
    "whatsapp_business" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_verified_name" TEXT,
    "last_whatsapp_check" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "contacts_phone_number_idx" ON "public"."contacts"("phone_number");

-- CreateIndex
CREATE INDEX "contacts_user_id_idx" ON "public"."contacts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_user_id_phone_number_key" ON "public"."contacts"("user_id", "phone_number");

-- AddForeignKey
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ImgGenRequest" (
    "id" SERIAL NOT NULL,
    "imageInbox" TEXT NOT NULL,
    "workerId" TEXT,
    "start" TIMESTAMP(3),
    "end" TIMESTAMP(3),
    "successful" BOOLEAN,
    "passesVerification" BOOLEAN,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImgGenRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlacklistedWorker" (
    "id" SERIAL NOT NULL,
    "workerID" TEXT NOT NULL,

    CONSTRAINT "BlacklistedWorker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImgGenRequest_imageInbox_key" ON "ImgGenRequest"("imageInbox");

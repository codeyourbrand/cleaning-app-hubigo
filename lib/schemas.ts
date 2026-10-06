import { Role, TaskType, TaskStatus } from "@prisma/client";
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
});

export const otpRequestSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
});

export const otpVerifySchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  code: z.string().length(6),
  rememberMe: z.boolean().optional().default(false),
});

export const userCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  role: z.enum([Role.CLEANER, Role.COORDINATOR]),
  password: z.string().min(6),
  active: z.boolean().optional().default(true),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  role: z.enum([Role.CLEANER, Role.COORDINATOR]).optional(),
  active: z.boolean().optional(),
});

export const apartmentSchema = z.object({
  number: z.string().min(1),
  building: z.string().optional(),
  floor: z.string().optional(),
  notes: z.string().optional(),
  externalHostfullyId: z.string().optional(),
  externalPropertyId: z.string().optional(),
});

export const taskCreateSchema = z.object({
  apartmentId: z.string().cuid(),
  title: z.string().optional(),
  date: z.coerce.date(),
  type: z.enum([
    TaskType.CHECK_OUT,
    TaskType.REFRESH,
    TaskType.CLEANING,
    TaskType.REPAIR,
    TaskType.OTHER,
  ]),
  customTypeName: z.string().optional(),
  checkoutTime: z.string().optional(),
  checkinWindow: z.string().optional(),
  guestsCount: z.coerce.number().int().min(0).optional(),
  nightsCount: z.coerce.number().int().min(0).optional(),
  requests: z.string().optional(),
  instructions: z.string().optional(),
  assignedToUserId: z.string().cuid().optional().nullable(),
  steps: z.array(z.string()).optional().default([]),
});

export const taskUpdateSchema = z.object({
  apartmentId: z.string().cuid().optional(),
  title: z.string().optional().nullable(),
  date: z.coerce.date().optional(),
  type: z
    .enum([
      TaskType.CHECK_OUT,
      TaskType.REFRESH,
      TaskType.CLEANING,
      TaskType.REPAIR,
      TaskType.OTHER,
    ])
    .optional(),
  customTypeName: z.string().optional().nullable(),
  checkoutTime: z.string().optional().nullable(),
  checkinWindow: z.string().optional().nullable(),
  guestsCount: z.coerce.number().int().min(0).optional().nullable(),
  nightsCount: z.coerce.number().int().min(0).optional().nullable(),
  requests: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  assignedToUserId: z.string().cuid().optional().nullable(),
  status: z
    .enum([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE])
    .optional(),
});

export const taskStepUpdateSchema = z.object({
  done: z.boolean(),
});

export const commentSchema = z.object({
  taskId: z.string().cuid(),
  parentId: z.string().cuid().optional().nullable(),
  body: z.string().min(1),
});

export const lostFoundSchema = z.object({
  apartmentId: z.string().cuid(),
  description: z.string().min(1),
  photoUrl: z.string().optional(),
});

export const damageSchema = z.object({
  apartmentId: z.string().cuid(),
  description: z.string().min(1),
  photoUrl: z.string().optional(),
});

export const importRowSchema = z.object({
  apartmentNumber: z.string().min(1),
  checkoutTime: z.string().optional(),
  checkinWindow: z.string().optional(),
  guestsCount: z.coerce.number().int().min(0).optional(),
  nightsCount: z.coerce.number().int().min(0).optional(),
  requests: z.string().optional(),
  instructions: z.string().optional(),
});

export const csvImportSchema = z.object({
  rows: z.array(importRowSchema),
  date: z.coerce.date(),
});

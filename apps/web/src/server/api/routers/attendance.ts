// todo: fix overall attendance for mentor exceeding 100%
import type { Role, Prisma } from "@prisma/client";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@tutly/db";

interface StudentData {
  Duration: number;
  username: string;
  Joins?: Prisma.InputJsonValue;
}

interface AttendanceRecord {
  username: string;
  name: string;
  mail: string | null;
  image: string | null;
  role: Role;
  count: number;
}

export const attendanceRouter = createTRPCRouter({
  postAttendance: protectedProcedure
    .input(
      z.object({
        classId: z.string(),
        data: z.array(z.record(z.unknown())),
        maxInstructionDuration: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      const parsedData = JSON.parse(
        JSON.stringify(input.data),
      ) as StudentData[];

      const attendanceData: Prisma.AttendanceCreateManyInput[] = parsedData.map(
        (student) => {
          const baseData = {
            classId: input.classId,
            username: student.username,
            attendedDuration: student.Duration,
            data: [student.Joins ?? {}] as Prisma.InputJsonValue[],
          };

          if (student.Duration >= input.maxInstructionDuration) {
            return {
              ...baseData,
              attended: true,
            };
          }
          return baseData;
        },
      );

      const postAttendance = await db.attendance.createMany({
        data: attendanceData,
      });

      return { success: true, data: postAttendance };
    }),

  getAttendanceForMentorByIdBarChart: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        courseId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const attendance = await db.attendance.findMany({
        where: {
          user: {
            enrolledUsers: {
              some: {
                mentorUsername: input.id,
              },
            },
          },
          attended: true,
        },
      });

      const getAllClasses = await db.class.findMany({
        where: {
          courseId: input.courseId,
        },
        select: {
          id: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      const classes: string[] = [];
      const attendanceInEachClass: number[] = [];
      getAllClasses.forEach((classData) => {
        classes.push(classData.createdAt.toISOString().split("T")[0] ?? "");
        const tem = attendance.filter(
          (attendanceData) => attendanceData.classId === classData.id,
        );
        attendanceInEachClass.push(tem.length);
      });

      return { success: true, data: { classes, attendanceInEachClass } };
    }),

  getAttendanceForMentorBarChart: protectedProcedure
    .input(
      z.object({
        courseId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const currentUser = ctx.session?.user;
      if (!currentUser) return { error: "Unauthorized" };

      let attendance;
      if (currentUser.role === "MENTOR") {
        attendance = await db.attendance.findMany({
          where: {
            user: {
              enrolledUsers: {
                some: {
                  mentorUsername: currentUser.username,
                },
              },
            },
            attended: true,
            class: {
              course: {
                id: input.courseId,
              },
            },
          },
        });
      } else {
        attendance = await db.attendance.findMany({
          where: {
            attended: true,
            class: {
              courseId: input.courseId,
            },
          },
        });
      }

      const getAllClasses = await db.class.findMany({
        where: {
          courseId: input.courseId,
        },
        select: {
          id: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      const classes: string[] = [];
      const attendanceInEachClass: number[] = [];
      getAllClasses.forEach((classData) => {
        classes.push(classData.createdAt.toISOString().split("T")[0] ?? "");
        const tem = attendance.filter(
          (attendanceData) => attendanceData.classId === classData.id,
        );
        attendanceInEachClass.push(tem.length);
      });

      return { success: true, data: { classes, attendanceInEachClass } };
    }),

  getAttedanceByClassId: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const attendance = await db.attendance.findMany({
        where: {
          classId: input.id,
        },
      });

      return { success: true, data: attendance };
    }),

  getAttendanceOfStudent: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        courseId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const attendance = await db.attendance.findMany({
        where: {
          username: input.id,
          AND: {
            class: {
              course: {
                id: input.courseId,
              },
            },
          },
        },
        select: {
          class: {
            select: {
              createdAt: true,
            },
          },
        },
      });

      const attendanceDates: string[] = [];
      attendance.forEach((attendanceData) => {
        attendanceDates.push(
          attendanceData.class.createdAt.toISOString().split("T")[0] ?? "",
        );
      });

      const getAllClasses = await db.class.findMany({
        where: {
          courseId: input.courseId,
        },
        select: {
          id: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      const classes: string[] = [];
      getAllClasses.forEach((classData) => {
        if (
          !attendanceDates.includes(
            classData.createdAt.toISOString().split("T")[0] ?? "",
          )
        ) {
          classes.push(classData.createdAt.toISOString().split("T")[0] ?? "");
        }
      });

      return { success: true, data: { classes, attendanceDates } };
    }),

  deleteClassAttendance: protectedProcedure
    .input(
      z.object({
        classId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const currentUser = ctx.session?.user;
      if (!currentUser) {
        return { error: "You must be logged in to attend a class" };
      }
      if (currentUser.role !== "INSTRUCTOR") {
        return { error: "You must be an instructor to delete an attendance" };
      }

      const attendance = await db.attendance.deleteMany({
        where: {
          classId: input.classId,
        },
      });

      return { success: true, data: attendance };
    }),

  getTotalNumberOfClassesAttended: protectedProcedure.query(async ({ ctx }) => {
    const currentUser = ctx.session?.user;
    if (!currentUser || currentUser.role === "STUDENT") {
      return {
        error:
          "You must be logged in as an instructor or mentor to view attendance",
      };
    }

    let attendance;
    if (currentUser.role === "MENTOR") {
      attendance = await db.attendance.findMany({
        where: {
          user: {
            enrolledUsers: {
              some: {
                mentorUsername: currentUser.username,
              },
            },
          },
        },
        select: {
          username: true,
          user: true,
          attended: true,
        },
      });
    } else {
      attendance = await db.attendance.findMany({
        where: {
          user: {
            role: "STUDENT",
          },
        },
        select: {
          username: true,
          user: true,
          attended: true,
        },
      });
    }

    const groupByTotalAttendance: Record<string, AttendanceRecord> = {};

    attendance.forEach((attendanceData) => {
      if (attendanceData.attended && attendanceData.username) {
        const existingRecord = groupByTotalAttendance[attendanceData.username];
        if (existingRecord) {
          groupByTotalAttendance[attendanceData.username] = {
            ...existingRecord,
            count: existingRecord.count + 1,
          };
        } else {
          groupByTotalAttendance[attendanceData.username] = {
            username: attendanceData.username,
            name: attendanceData.user.name,
            mail: attendanceData.user.email,
            image: attendanceData.user.image,
            role: attendanceData.user.role,
            count: 1,
          };
        }
      }
    });

    return { success: true, data: groupByTotalAttendance };
  }),

  getAttendanceForLeaderbaord: protectedProcedure.query(async ({ ctx }) => {
    const currentUser = ctx.session?.user;
    if (!currentUser) {
      return { error: "You must be logged in to attend a class" };
    }

    const attendance = await db.attendance.findMany({
      where: {
        attended: true,
      },
      select: {
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    const groupedAttendance = attendance.reduce(
      (acc: Record<string, number>, curr) => {
        const username = curr.user.username;
        acc[username] = (acc[username] ?? 0) + 1;
        return acc;
      },
      {},
    );

    return { success: true, data: groupedAttendance };
  }),

  getAttendanceOfAllStudents: protectedProcedure.query(async ({ ctx }) => {
    const currentUser = ctx.session?.user;
    if (!currentUser) {
      return { error: "You must be logged in to attend a class" };
    }

    const enrolledUsers = await db.enrolledUsers.findMany({
      where: {
        username: currentUser.username ?? "",
        user: {
          organizationId: currentUser.organizationId,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const courseId = enrolledUsers[0]?.courseId ?? "";

    const totalAttendance = await serverActionOfgetTotalNumberOfClassesAttended(
      currentUser.username,
      currentUser.role,
      courseId,
    );
    const totalCount = await serverActionOftotatlNumberOfClasses(courseId);

    const jsonData = totalAttendance
      ? Object.entries(totalAttendance).map(([_, value]) => ({
          username: value.username,
          name: value.name,
          mail: value.mail,
          image: value.image,
          role: value.role,
          percentage: (Number(value.count) * 100) / Number(totalCount),
        }))
      : [];

    return { success: true, data: jsonData };
  }),

  viewAttendanceByClassId: protectedProcedure
    .input(
      z.object({
        classId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const currentUser = ctx.session?.user;
      if (!currentUser) {
        return { error: "You must be logged in to view attendance" };
      }

      if (currentUser.role === "STUDENT") {
        return {
          error: "You must be an instructor or mentor to view attendance",
        };
      }

      const attendance =
        currentUser.role === "MENTOR"
          ? await db.attendance.findMany({
              where: {
                classId: input.classId,
                user: {
                  enrolledUsers: {
                    some: {
                      mentorUsername: currentUser.username,
                    },
                  },
                },
              },
              include: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            })
          : await db.attendance.findMany({
              where: {
                classId: input.classId,
              },
              include: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            });

      let present = 0;

      attendance.forEach((ele) => {
        if (ele.attended) {
          present++;
        }
      });

      return { success: true, data: { attendance, present } };
    }),
});

// Helper functions
async function serverActionOfgetTotalNumberOfClassesAttended(
  username: string,
  role: Role,
  courseId: string,
) {
  let attendance;
  if (role === "MENTOR") {
    attendance = await db.attendance.findMany({
      where: {
        user: {
          enrolledUsers: {
            some: {
              mentorUsername: username,
              courseId,
            },
          },
        },
      },
      select: {
        username: true,
        user: true,
        attended: true,
      },
    });
  } else {
    attendance = await db.attendance.findMany({
      where: {
        user: {
          role: "STUDENT",
        },
        class: {
          courseId,
        },
      },
      select: {
        username: true,
        user: true,
        attended: true,
      },
    });
  }

  const groupByTotalAttendance: Record<string, AttendanceRecord> = {};

  attendance.forEach((attendanceData) => {
    if (attendanceData.attended && attendanceData.username) {
      const existingRecord = groupByTotalAttendance[attendanceData.username];
      if (existingRecord) {
        groupByTotalAttendance[attendanceData.username] = {
          ...existingRecord,
          count: existingRecord.count + 1,
        };
      } else {
        groupByTotalAttendance[attendanceData.username] = {
          username: attendanceData.username,
          name: attendanceData.user.name,
          mail: attendanceData.user.email,
          image: attendanceData.user.image,
          role: attendanceData.user.role,
          count: 1,
        };
      }
    }
  });

  return groupByTotalAttendance;
}

async function serverActionOftotatlNumberOfClasses(courseId: string) {
  const getAllClasses = await db.class.count({
    where: {
      courseId,
    },
  });

  return getAllClasses;
}

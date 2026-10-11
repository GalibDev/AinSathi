import { z } from "zod";
import { call } from "./firebase";
import {
  caseSchema,
  clientSchema,
  hearingSchema,
  documentSchema,
  memberSchema,
  organizationSchema,
  eventSchema,
  noteSchema,
  notificationSchema,
  reportSchema,
  validateFile,
} from "./schema";
import type {
  CaseFilters,
  CaseInput,
  ClientInput,
  HearingInput,
  CaseRecord,
  DocumentRecord,
  Role,
} from "./schema";
export class FirebaseRepository {
  readonly demo = false;
  async memberships() {
    return z.array(memberSchema).parse(await call("memberships"));
  }
  async organizations() {
    return z.array(organizationSchema).parse(await call("organizations"));
  }
  async members(org: string) {
    return z.array(memberSchema).parse(await call("members", { org }));
  }
  async listCases(org: string, filters: CaseFilters) {
    return z.array(caseSchema).parse(await call("listCases", { org, filters }));
  }
  async getCase(org: string, id: string) {
    return caseSchema.parse(await call("getCase", { org, id }));
  }
  async listClients(org: string, query = "", page = 0) {
    return z
      .array(clientSchema)
      .parse(await call("listClients", { org, query, page }));
  }
  async getClient(org: string, id: string) {
    return clientSchema.parse(await call("getClient", { org, id }));
  }
  async clientCases(org: string, id: string) {
    return z.array(caseSchema).parse(await call("clientCases", { org, id }));
  }
  async saveClient(org: string, input: ClientInput, id?: string) {
    return clientSchema.parse(
      await call("saveClient", { org, input, ...(id ? { id } : {}) }),
    );
  }
  async saveCase(org: string, input: CaseInput, id?: string) {
    return caseSchema.parse(
      await call("saveCase", { org, input, ...(id ? { id } : {}) }),
    );
  }
  async status(
    org: string,
    id: string,
    status: CaseRecord["status"],
    closed_date: string | null = null,
    closure_result = "",
  ) {
    await call("status", { org, id, status, closed_date, closure_result });
  }
  async archive(org: string, table: "cases" | "clients", id: string) {
    await call("archive", { org, table, id });
  }
  async listHearings(org: string, from: string, to: string, caseId?: string) {
    return z
      .array(hearingSchema)
      .parse(
        await call("listHearings", {
          org,
          from,
          to,
          ...(caseId ? { caseId } : {}),
        }),
      );
  }
  async saveHearing(org: string, input: HearingInput, id?: string) {
    return hearingSchema.parse(
      await call("saveHearing", { org, input, ...(id ? { id } : {}) }),
    );
  }
  async listDocuments(org: string, caseId?: string) {
    return z
      .array(documentSchema)
      .parse(
        await call("listDocuments", { org, ...(caseId ? { caseId } : {}) }),
      );
  }
  async upload(org: string, caseId: string, file: File) {
    await validateFile(file);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("ফাইল পড়া যায়নি।"));
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.readAsDataURL(file);
    });
    return documentSchema.parse(
      await call("upload", {
        org,
        caseId,
        name: file.name,
        mime: file.type,
        base64,
      }),
    );
  }
  async download(doc: DocumentRecord) {
    return z
      .string()
      .url()
      .parse(await call("download", { org: doc.organization_id, id: doc.id }));
  }
  async archiveDocument(org: string, id: string) {
    await call("archiveDocument", { org, id });
  }
  async caseHistory(org: string, caseId: string) {
    return z
      .array(eventSchema)
      .parse(await call("caseHistory", { org, caseId }));
  }
  async caseNotes(org: string, caseId: string) {
    return z.array(noteSchema).parse(await call("caseNotes", { org, caseId }));
  }
  async addNote(org: string, caseId: string, body: string) {
    await call("addNote", { org, caseId, body });
  }
  async report(org: string, from = "", to = "") {
    return reportSchema.parse(await call("report", { org, from, to }));
  }
  async listNotifications(org: string) {
    return z
      .array(notificationSchema)
      .parse(await call("listNotifications", { org }));
  }
  async readNotification(org: string, id: string) {
    await call("readNotification", { org, id });
  }
  async invite(org: string, email: string, role: Role) {
    return z.string().parse(await call("invite", { org, email, role }));
  }
  async changeRole(org: string, userId: string, role: Role) {
    await call("changeRole", { org, userId, role });
  }
  async assignments(org: string, caseId: string) {
    return z
      .array(z.string())
      .parse(await call("assignments", { org, caseId }));
  }
  async assign(org: string, caseId: string, userId: string) {
    await call("assign", { org, caseId, userId });
  }
  async unassign(org: string, caseId: string, userId: string) {
    await call("unassign", { org, caseId, userId });
  }
  async saveOrganization(org: string, name: string, address: string) {
    await call("saveOrganization", { org, name, address });
  }
}

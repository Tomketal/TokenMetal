import { NextResponse } from "next/server";
import { patchPosition, listPositions } from "@/lib/positions/store";
import {
  buildTriggerOrderSnapshot,
  confirmTriggerOrderCancellation,
  craftTriggerDeposit,
  createTriggerOcoOrder,
  deriveTriggerOcoDraft,
  fetchTriggerOrderById,
  getOrRegisterTriggerVault,
  mergeTriggerOrderFromHistory,
  prepareTriggerOrderCancellation,
  requestTriggerChallenge,
  verifyTriggerChallenge
} from "@/lib/trigger/v2";
import { triggerOcoRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = triggerOcoRequestSchema.parse(await request.json());

    if (body.action === "challenge") {
      const challenge = await requestTriggerChallenge(body.owner, body.challengeType || "message");
      return NextResponse.json({ challenge });
    }

    if (body.action === "authenticate") {
      const auth = await verifyTriggerChallenge({
        walletPubkey: body.owner,
        ...body.proof
      });
      return NextResponse.json({ authToken: auth.token });
    }

    if (body.action === "craft") {
      const position = await getOpenPosition(body.owner, body.positionId);
      const draft = deriveTriggerOcoDraft(position);
      const auth = await verifyTriggerChallenge({
        walletPubkey: body.owner,
        ...body.proof
      });

      await getOrRegisterTriggerVault(auth.token);
      const deposit = await craftTriggerDeposit(auth.token, {
        inputMint: draft.inputMint,
        outputMint: draft.outputMint,
        userAddress: body.owner,
        amount: draft.inputAmount
      });

      return NextResponse.json({
        authToken: auth.token,
        deposit,
        draft
      });
    }

    if (body.action === "confirm") {
      const position = await getOpenPosition(body.owner, body.positionId);
      const draft = deriveTriggerOcoDraft(position);
      const created = await createTriggerOcoOrder(body.authToken, {
        depositRequestId: body.depositRequestId,
        depositSignedTx: body.depositSignedTx,
        userPubkey: body.owner,
        draft
      });

      const triggerOrder = buildTriggerOrderSnapshot(draft, created);
      const updated = await patchPosition(body.positionId, body.owner, { triggerOrder });

      return NextResponse.json({ position: updated });
    }

    if (body.action === "sync") {
      const position = await getOwnedPosition(body.owner, body.positionId);
      if (!position.triggerOrder?.orderId) {
        throw new Error("No trigger order found for this position.");
      }

      const order = await fetchTriggerOrderById(body.authToken, position.triggerOrder.orderId);
      if (!order) {
        const updated = await patchPosition(body.positionId, body.owner, {
          triggerOrder: {
            ...position.triggerOrder,
            orderState: "unknown",
            lastSyncedAt: new Date().toISOString()
          }
        });
        return NextResponse.json({ position: updated, found: false });
      }

      const merged = mergeTriggerOrderFromHistory(position.triggerOrder, order);
      const updated = await patchPosition(body.positionId, body.owner, { triggerOrder: merged });
      return NextResponse.json({ position: updated, found: true });
    }

    if (body.action === "cancelCraft") {
      const position = await getOwnedPosition(body.owner, body.positionId);
      const existingTriggerOrder = position.triggerOrder;
      const orderId = existingTriggerOrder?.orderId;
      if (!orderId || !existingTriggerOrder) throw new Error("No trigger order found for this position.");

      const cancellation = await prepareTriggerOrderCancellation(body.authToken, orderId);

      const updated = await patchPosition(body.positionId, body.owner, {
        triggerOrder: {
          ...existingTriggerOrder,
          orderState: "pending_withdraw",
          updatedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString()
        }
      });

      return NextResponse.json({
        position: updated,
        cancellation
      });
    }

    if (body.action === "cancelConfirm") {
      const position = await getOwnedPosition(body.owner, body.positionId);
      const orderId = position.triggerOrder?.orderId;
      if (!orderId) throw new Error("No trigger order found for this position.");

      await confirmTriggerOrderCancellation(body.authToken, orderId, {
        cancelRequestId: body.cancelRequestId,
        signedTransaction: body.cancelSignedTx
      });

      const updated = await patchPosition(body.positionId, body.owner, {
        triggerOrder: undefined
      });

      return NextResponse.json({ position: updated });
    }

    throw new Error("Unsupported action.");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to process trigger order request." },
      { status: 400 }
    );
  }
}

async function getOwnedPosition(owner: string, positionId: string) {
  const positions = await listPositions(owner);
  const position = positions.find((item) => item.id === positionId);
  if (!position) throw new Error("Position not found.");
  return position;
}

async function getOpenPosition(owner: string, positionId: string) {
  const position = await getOwnedPosition(owner, positionId);
  if (position.status !== "open") throw new Error("Position is not open.");
  return position;
}

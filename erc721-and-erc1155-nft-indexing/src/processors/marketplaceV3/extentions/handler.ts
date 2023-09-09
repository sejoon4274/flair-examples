import { EventHandlerInput } from "flair-sdk";
import { getOrCreateCollection } from "../../../lib/collection";
import {
  MarketplaceV3NewListingArgs,
  MarketplaceV3PlatformFeeInfoUpdatedArgs,
  NewListing,
  PlatformFeeInfoUpdated
} from "../../../types";
import {upsertNewListing, upsertPlatformFeeInfoUpdated} from "../../../lib/tokens";
import { throttledPromiseAll } from "../../../lib/common";

/**
 * This processor receives ERC1155 SingleTransfer and BatchTransfer events
 */
export async function processEvent(
  event: EventHandlerInput<MarketplaceV3NewListingArgs | MarketplaceV3PlatformFeeInfoUpdatedArgs>
) {
  if (!event.parsed.args) {
    throw new Error("Missing event.parsed.args");
  }

  const contractAddress = event.log.address.toString();
  await getOrCreateCollection(event.chainId, contractAddress, true, {
    // This forces contracts that don't have interface flag to be updated
    // even if they don't support standard ERC173.
    // interfaceERC1155: true,
  });

  const newListingUpserts = await generateNewListingUpserts(event);
  const platformFeeInfoUpdatedUpserts = await generatePlatformFeeInfoUpdatedUpserts(event);

  if(newListingUpserts.length > 0) {
    await throttledPromiseAll(newListingUpserts);
  }
  if(platformFeeInfoUpdatedUpserts.length > 0) {
    await throttledPromiseAll(platformFeeInfoUpdatedUpserts);
  }
}



async function generateNewListingUpserts(
  event: EventHandlerInput<MarketplaceV3NewListingArgs | MarketplaceV3PlatformFeeInfoUpdatedArgs>
): Promise<(() => Promise<NewListing>)[]> {
  const newListingUpserts: (() => Promise<NewListing>)[] = [];

  if (event.parsed.name === "NewListing") {
    const evt = event as EventHandlerInput<MarketplaceV3NewListingArgs>;
    const args = evt.parsed.args as MarketplaceV3NewListingArgs;
    newListingUpserts.push(() =>
      upsertNewListing(evt, args.listingCreator, args.listingId, args.assetContract)
    );
  }

  return newListingUpserts;
}

async function generatePlatformFeeInfoUpdatedUpserts(
  event: EventHandlerInput<MarketplaceV3NewListingArgs | MarketplaceV3PlatformFeeInfoUpdatedArgs>
): Promise<(() => Promise<PlatformFeeInfoUpdated>)[]> {
  const newListingUpserts: (() => Promise<PlatformFeeInfoUpdated>)[] = [];

  if (event.parsed.name === "NewListing") {
    const evt = event as EventHandlerInput<MarketplaceV3PlatformFeeInfoUpdatedArgs>;
    const args = evt.parsed.args as MarketplaceV3PlatformFeeInfoUpdatedArgs;
    newListingUpserts.push(() =>
      upsertPlatformFeeInfoUpdated(evt, args.platformFeeRecipient, args.platformFeeBps)
    );
  }

  return newListingUpserts;
}

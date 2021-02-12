import fetch from "node-fetch";
import * as _ from "lodash";

const token = process.env.TOKEN as string;

interface SpotifyQuery {
  method: "GET" | "PUT" | "POST" | "DELETE";
  endpoint: string;
  body?: Record<string, unknown>;
}

interface GetTracksResponse {
  items: {
    added_at: string;
    track: {
      uri: string;
    };
  }[];
  next: string;
}

interface GetMeResponse {
  id: string | undefined;
}

interface CreatePlaylistResponse {
  id: string;
}

const getMeQuery: SpotifyQuery = {
  method: "GET",
  endpoint: "https://api.spotify.com/v1/me",
};

const createCreatePlaylistMutation = (
  userId: string,
  playlistId: string
): SpotifyQuery => ({
  method: "POST",
  endpoint: `https://api.spotify.com/v1/users/${userId}/playlists`,
  body: {
    name: playlistId,
  },
});

const createGetSavedTracksQuery = (offset: number): SpotifyQuery => ({
  method: "GET",
  endpoint: `https://api.spotify.com/v1/me/tracks?limit=50&offset=${offset}`,
});

async function* getMoreTrackUris(): AsyncIterableIterator<{ uri: string }> {
  let hasMoreSongs = true;
  let offset = 0;
  while (hasMoreSongs) {
    const resp: GetTracksResponse = await makeSpotifyRequest(
      createGetSavedTracksQuery(offset)
    );
    const uris = resp.items.map(({ track }) => ({ uri: track.uri }));
    console.log("Gathering tracks: ", offset);
    if (uris.length === 0) {
      hasMoreSongs = false;
    }
    yield* uris;
    offset += 50;
  }
}

const createAddItemsToPlaylistMutation = (
  playlistId: string,
  uris: string[]
): SpotifyQuery => ({
  method: "POST",
  endpoint: `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
  body: {
    uris,
  },
});

const makeSpotifyRequest = async <T = never>(
  query: SpotifyQuery
): Promise<T> => {
  const resp = await fetch(query.endpoint, {
    method: query.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: query.body === undefined ? undefined : JSON.stringify(query.body),
  });
  const data = resp.json();
  return (data as unknown) as T;
};

const main = async () => {
  const playlistName = `What Type Of Dog Is This?`;
  const { id: userId } = await makeSpotifyRequest<GetMeResponse>(getMeQuery);
  if (userId === undefined) {
    console.log("\n\nDo you bark dog? Bad token.\n\n");
    process.exit(1);
  }
  console.log("King of the castle!", userId);
  const { id: playlistId } = await makeSpotifyRequest<CreatePlaylistResponse>(
    createCreatePlaylistMutation(userId, playlistName)
  );
  console.log("I like!", playlistId);
  const allTrackUris = [];
  for await (const uris of getMoreTrackUris()) {
    allTrackUris.push(uris);
  }
  const shuffled = await _.shuffle(allTrackUris);
  while (shuffled.length > 0) {
    console.log("Publishing tracks: ", shuffled.length);
    const buffer: { uri: string }[] = shuffled.splice(0, 100);
    const uris = buffer.map(({ uri }) => uri);
    const resp = await makeSpotifyRequest(
      createAddItemsToPlaylistMutation(playlistId, uris)
    );
  }
  console.log("Very Naice!");
};

main();

"use client";

import { useGetOwnSpeakerProfile } from "../hooks/useGetOwnSpeakerProfile";
import { useUpdateOwnSpeakerProfile } from "../hooks/useUpdateOwnSpeakerProfile";
import { useUploadOwnSpeakerPhoto } from "../hooks/useUploadOwnSpeakerPhoto";
import { SpeakerProfileForm } from "./SpeakerProfileForm";
import {
  SpeakerProfileError,
  SpeakerProfileSkeleton,
} from "./SpeakerProfileStates";

/**
 * The "Edit my profile" page content: loads the speaker's own profile (GET /api/me/speaker-profile)
 * and saves the photo and the details with their two endpoints. Loading and error states are here;
 * the form only knows how to edit.
 */
export function OwnSpeakerProfile() {
  const { data, error, isPending, refetch } = useGetOwnSpeakerProfile();
  const updateProfile = useUpdateOwnSpeakerProfile();
  const uploadPhoto = useUploadOwnSpeakerPhoto();

  if (isPending) return <SpeakerProfileSkeleton />;
  if (error) {
    return (
      <SpeakerProfileError
        message={error.message}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <SpeakerProfileForm
      initialValues={data}
      // mutateAsync rejects with an ApiError: the form shows its message.
      onSubmit={async (body) => {
        await updateProfile.mutateAsync(body);
      }}
      onUploadPhoto={async (file) => {
        await uploadPhoto.mutateAsync(file);
      }}
    />
  );
}

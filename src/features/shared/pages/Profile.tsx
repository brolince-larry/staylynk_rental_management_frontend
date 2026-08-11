import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, Mail, Save, ShieldCheck } from 'lucide-react'
import { profileApi } from '@/api/profile'
import { Button, FormField, Input, ToastContainer } from '@/components/forms'
import { MediaUploadField, SmartImage } from '@/components/media'
import { OtpVerifyModal } from '@/components/shared/OtpVerifyModal'
import { PageHeader, SectionCard } from '@/components/ui'
import { useToast } from '@/hooks'
import { useAuthStore } from '@/store/auth.store'

const APPROVAL_MESSAGE = 'Approval email sent. Confirm from your email to apply changes.'
const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024

export default function Profile(): React.ReactElement {
  const { toasts, success, error: toastError, dismiss } = useToast()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const [name, setName] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [otpType, setOtpType] = useState<'email' | 'password' | null>(null)

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: () => profileApi.get().then((r) => r.data),
  })

  const nameValue = name ?? profile?.name ?? ''
  const phoneValue = phone ?? profile?.phone ?? ''

  const updateProfile = useMutation({
    mutationFn: () => profileApi.update({ name: nameValue.trim(), phone: phoneValue.trim() }),
    onSuccess: (res) => {
      const updated = res.data
      if (user) {
        setUser({
          ...user,
          name: updated.name ?? nameValue.trim(),
          phone: updated.phone ?? phoneValue.trim(),
        })
      }
      success('Profile updated')
      void refetch()
    },
    onError: (err) => toastError(err, 'Failed to update profile'),
  })

  const uploadPhoto = useMutation({
    mutationFn: () => {
      const file = photoFiles[0]
      if (!file) throw new Error('Select a profile photo first.')
      if (file.size > PROFILE_PHOTO_MAX_BYTES) throw new Error('Profile photo must be 2MB or smaller.')

      const form = new FormData()
      form.append('file', file)
      form.append('alt_text', `${nameValue.trim() || profile?.name || 'User'} profile photo`)
      return profileApi.uploadPhoto(form)
    },
    onSuccess: async (res) => {
      setPhotoFiles([])
      const refreshed = await refetch()
      const updated = refreshed.data ?? res.data
      if (user && updated) {
        setUser({
          ...user,
          avatar_image: 'avatar_image' in updated ? updated.avatar_image as Record<string, unknown> | null : user.avatar_image,
          avatar_url: 'avatar_url' in updated ? updated.avatar_url as string | null : user.avatar_url,
        })
      }
      success('Profile photo updated')
    },
    onError: (err) => toastError(err, 'Failed to upload profile photo'),
  })

  const requestEmailChange = useMutation({
    mutationFn: () => profileApi.requestChange({
      type: 'email',
      current_password: emailPassword,
      email: newEmail.trim(),
    }),
    onSuccess: () => {
      setOtpType('email')
    },
    onError: (err) => toastError(err, 'Failed to request email change'),
  })

  const requestPasswordChange = useMutation({
    mutationFn: () => profileApi.requestChange({
      type: 'password',
      current_password: currentPassword,
      password: newPassword,
      password_confirmation: confirmPassword,
    }),
    onSuccess: () => {
      setOtpType('password')
    },
    onError: (err) => toastError(err, 'Failed to request password change'),
  })

  const canSaveProfile = nameValue.trim().length >= 2
  const canUploadPhoto = photoFiles.length > 0
  const currentEmail = profile?.email ?? user?.email ?? ''
  const canRequestEmail = newEmail.trim().length > 0 && newEmail.trim() !== currentEmail && emailPassword.length > 0
  const canRequestPassword = currentPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0
  const avatarImage = profile?.avatar_image ?? user?.avatar_image ?? user?.media
  const avatarUrl = profile?.avatar_url ?? user?.avatar_url
  const displayName = nameValue.trim() || profile?.name || user?.name || 'User'

  return (
    <>
      <Helmet><title>Profile - StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader
          title="Profile"
          subtitle="Manage your account details and sensitive sign-in changes."
        />

        <div className="space-y-4">
          <SectionCard title="Basic Information">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => <div key={item} className="h-10 animate-pulse rounded bg-muted" />)}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-5 sm:col-span-2 sm:flex-row sm:items-center">
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-3xl font-semibold text-primary ring-4 ring-background shadow-sm">
                    {avatarImage || avatarUrl ? (
                      <SmartImage
                        src={avatarImage ?? avatarUrl}
                        fallback={avatarUrl ?? undefined}
                        alt={`${displayName} profile photo`}
                        usage="card"
                        aspectRatio="1 / 1"
                        sizes="112px"
                        wrapperClassName="h-28 w-28 rounded-full"
                        className="rounded-full object-cover"
                      />
                    ) : (
                      displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <MediaUploadField
                      label="Profile Photo"
                      mediaType="profile_photo"
                      files={photoFiles}
                      onChange={setPhotoFiles}
                      hint="JPG, PNG, WebP, or HEIC up to 2MB."
                    />
                  </div>
                  <Button disabled={!canUploadPhoto} loading={uploadPhoto.isPending} onClick={() => uploadPhoto.mutate()}>
                    Upload Photo
                  </Button>
                </div>
                <FormField label="Name" htmlFor="profile-name" required>
                  <Input id="profile-name" value={nameValue} onChange={(event) => setName(event.target.value)} />
                </FormField>
                <FormField label="Phone" htmlFor="profile-phone">
                  <Input id="profile-phone" value={phoneValue} onChange={(event) => setPhone(event.target.value)} />
                </FormField>
                <div className="sm:col-span-2">
                  <Button disabled={!canSaveProfile} loading={updateProfile.isPending} onClick={() => updateProfile.mutate()}>
                    <Save className="h-3.5 w-3.5" /> Save Profile
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Sensitive Changes">
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>You'll be logged out after confirming an email or password change from your email.</span>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Mail className="h-4 w-4 text-primary" /> Email
                </div>
                <FormField label="Current Email" htmlFor="current-email">
                  <Input id="current-email" value={currentEmail} disabled />
                </FormField>
                <FormField label="New Email" htmlFor="new-email" required>
                  <Input id="new-email" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} />
                </FormField>
                <FormField label="Current Password" htmlFor="email-password" required>
                  <Input id="email-password" type="password" value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} />
                </FormField>
                <Button disabled={!canRequestEmail} loading={requestEmailChange.isPending} onClick={() => requestEmailChange.mutate()}>
                  Request Email Change
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Password
                </div>
                <FormField label="Current Password" htmlFor="current-password" required>
                  <Input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                </FormField>
                <FormField label="New Password" htmlFor="new-password" required>
                  <Input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                </FormField>
                <FormField label="Confirm Password" htmlFor="confirm-password" required>
                  <Input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                </FormField>
                <Button disabled={!canRequestPassword} loading={requestPasswordChange.isPending} onClick={() => requestPasswordChange.mutate()}>
                  Request Password Change
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>

        {otpType && (
          <OtpVerifyModal
            title={otpType === 'email' ? 'Confirm your new email' : 'Confirm your new password'}
            description="Enter the 6-digit code sent to your email. It expires in 5 minutes."
            onClose={() => setOtpType(null)}
            onSubmit={async (code) => {
              await profileApi.verifyChange(otpType, code)
              setOtpType(null)
              if (otpType === 'email') {
                setNewEmail('')
                setEmailPassword('')
              } else {
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
              }
              success('Change confirmed. Please log in again.')
              window.location.href = '/login'
            }}
          />
        )}
      </div>
    </>
  )
}

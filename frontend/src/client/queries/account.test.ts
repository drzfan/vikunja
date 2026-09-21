import {beforeEach, describe, expect, it, vi} from 'vitest'
import {QueryClient} from '@tanstack/vue-query'
import {accountKeys, updateSettingsMutationOptions} from './account'
import {invalidateAvatarQueries} from './avatars'
const sdk = vi.hoisted(() => ({userUpdateSettings: vi.fn(), userShow: vi.fn(), userGetAvatarProvider: vi.fn()}))
vi.mock('@/client/generated', () => sdk)
vi.mock('@/message', () => ({error: vi.fn(), success: vi.fn()}))
vi.mock('./avatars', () => ({invalidateAvatarQueries: vi.fn()}))

describe('account settings mutations', () => {
	beforeEach(() => {vi.clearAllMocks()})
	it('merges settings into the current account while preserving profile facts', async () => {
		const client = new QueryClient()
		const previous = {
			id: 1,
			is_admin: true,
			username: 'ada',
			name: 'Old',
			settings: {name: 'Old'},
		}
		client.setQueryData(accountKeys.user(1), previous)
		sdk.userUpdateSettings.mockResolvedValue({data: {}})
		sdk.userGetAvatarProvider.mockResolvedValue({data: {avatar_provider: 'initials'}})
		const settings = {
			name: 'New',
			frontend_settings: {sidebar_width: 280},
		}

		await client.getMutationCache()
			.build(client, updateSettingsMutationOptions())
			.execute({settings, showMessage: false})

		expect(sdk.userUpdateSettings).toHaveBeenCalledWith({body: settings})
		expect(client.getQueryData(accountKeys.user(1))).toEqual({
			id: 1,
			is_admin: true,
			username: 'ada',
			name: 'New',
			settings: {
				name: 'New',
				frontend_settings: {sidebar_width: 280},
			},
		})
		await vi.waitFor(() => expect(invalidateAvatarQueries).toHaveBeenCalledTimes(1))
		expect(invalidateAvatarQueries).toHaveBeenCalledWith('ada')
	})
	it('leaves cached settings intact when the server rejects an update', async () => {
		const client = new QueryClient()
		const account = {id: 1, settings: {name: 'Original'}}
		client.setQueryData(accountKeys.user(1), account)
		sdk.userUpdateSettings.mockRejectedValue({status: 403})
		await expect(client.getMutationCache().build(client, updateSettingsMutationOptions()).execute({settings: {name: 'Rejected'}})).rejects.toEqual({status: 403})
		expect(client.getQueryData(accountKeys.user(1))).toEqual(account)
	})
})

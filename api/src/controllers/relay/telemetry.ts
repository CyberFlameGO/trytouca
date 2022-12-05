// Copyright 2022 Touca, Inc. Subject to Apache-2.0 License.

import { NextFunction, Request, Response } from 'express'
import { pick } from 'lodash-es'

import { wslFindByRole } from '../../models/index.js'
import { IUser, NodeModel } from '../../schemas/index.js'
import { analytics, EActivity, logger, mailUser } from '../../utils/index.js'

export async function telemetryHandle(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const data = pick(req.body, [
    'created_at',
    'messages_new',
    'node_id',
    'reports_new',
    'runtime_new',
    'sessions_new',
    'users_active',
    'versions_new'
  ])
  logger.info('received usage report from %s', data.node_id)
  const node = await NodeModel.findOne({ uuid: data.node_id })
  if (!node) {
    return next({ status: 404, errors: ['usage report has unknown source'] })
  }
  const user: IUser = {
    _id: node.uuid,
    email: node.email,
    fullname: node.name,
    platformRole: 'guest',
    username: undefined
  }
  await analytics.add_activity(EActivity.SelfHostedUsage, user, {
    company: node.company,
    ...data
  })

  const owners = await wslFindByRole('owner')
  await mailUser(owners[0], 'New Usage Report', 'user-feedback', {
    body: JSON.stringify(data),
    cname: node.company || 'N/A',
    email: node.email || 'noreply@touca.io',
    name: node.name || 'N/A',
    page: 'usage-data'
  })

  logger.info('processed usage report from %s', data.node_id)
  return res.status(204).send()
}

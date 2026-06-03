import re

with open('backend/api.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove wait  from erify_token calls
content = content.replace('await verify_token(', 'verify_token(')

# 2. List of function names to strip sync  from
funcs_to_strip = [
    'verify_token', 'verify_admin_role', 'verify_expert_role',
    'create_notification', 'create_community_post', 'like_community_post',
    'post_comment', 'register', 'login', 'forgot_password', 'verify_otp',
    'reset_password', 'search_crops', 'create_expert_request', 
    'create_expert_response', 'get_expert_stats', 'add_library_item', 
    'update_library_item', 'delete_library_item', 'admin_set_role', 
    'admin_ban_user', 'admin_delete_user', 'admin_get_stats', 
    'update_post_status', 'get_reports', 'admin_resolve_report', 
    'admin_deploy_model', 'admin_update_post_status', 'admin_delete_post', 
    'admin_send_broadcast', 'admin_relabel_data', 'update_profile', 
    'add_crop_to_calendar', 'toggle_task_status', 'delete_calendar_task',
    'get_comments'
]

for func in funcs_to_strip:
    # replace sync def func( with def func(
    content = re.sub(r'^async def ' + func + r'\(', r'def ' + func + '(', content, flags=re.MULTILINE)

with open('backend/api.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Refactoring complete.')
